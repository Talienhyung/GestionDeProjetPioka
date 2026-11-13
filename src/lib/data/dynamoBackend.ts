// src/lib/data/dynamoBackend.ts
import {
  type AttributeValue,
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  QueryCommand,
  type TransactWriteItem,
  TransactWriteItemsCommand,
  TransactionCanceledException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'
import { type Backend, type Stored, type WriteOp, uniqueViolation, writeConflict } from './backend'
import { model, revive, serialize } from './schema'

/**
 * Une seule table DynamoDB, clés `pk` / `sk` (chaînes) :
 *   pk = « M#<Modèle> », sk = id      → l'enregistrement (d : JSON, v : version)
 *   pk = « U#<Modèle> », sk = clé     → réservation d'une valeur unique
 * Un modèle entier se lit en une requête : à l'échelle d'une caravane
 * (quelques centaines de lignes), c'est rapide et ne coûte presque rien.
 */
export class DynamoBackend implements Backend {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly table: string,
    /** Préfixe des clés : permet aux tests de partager une table. */
    private readonly namespace = '',
  ) {}

  private pk(kind: 'M' | 'U', name: string): string {
    return `${this.namespace}${kind}#${name}`
  }

  async load(name: string): Promise<Map<string, Stored>> {
    const meta = model(name)
    const out = new Map<string, Stored>()
    let start: Record<string, AttributeValue> | undefined
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': { S: this.pk('M', name) } },
          ExclusiveStartKey: start,
          ConsistentRead: true,
        }),
      )
      for (const item of page.Items ?? []) {
        const data = revive(meta, JSON.parse(item.d.S ?? '{}'))
        out.set(item.sk.S ?? '', { data, version: Number(item.v.N) })
      }
      start = page.LastEvaluatedKey
    } while (start)
    return out
  }

  async commit(ops: WriteOp[]): Promise<void> {
    const items: { item: TransactWriteItem; unique?: string }[] = []
    for (const op of ops) {
      const key = { pk: { S: this.pk('M', op.model) }, sk: { S: op.id } }
      const condition =
        op.expect === null
          ? { ConditionExpression: 'attribute_not_exists(pk)' }
          : { ConditionExpression: 'v = :v', ExpressionAttributeValues: { ':v': { N: String(op.expect) } } }
      if (op.data === null) {
        items.push({ item: { Delete: { TableName: this.table, Key: key, ...condition } } })
      } else {
        const d = JSON.stringify(serialize(model(op.model), op.data))
        items.push({
          item: {
            Put: {
              TableName: this.table,
              Item: { ...key, d: { S: d }, v: { N: String((op.expect ?? 0) + 1) } },
              ...condition,
            },
          },
        })
      }
      for (const u of op.uniquesRemove) {
        items.push({ item: { Delete: { TableName: this.table, Key: this.uniqueKey(op.model, u) } } })
      }
      for (const u of op.uniquesAdd) {
        items.push({
          unique: u,
          item: {
            Put: {
              TableName: this.table,
              Item: { ...this.uniqueKey(op.model, u), ref: { S: op.id } },
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
        })
      }
    }

    // Une transaction DynamoDB porte au plus 100 éléments. Au-delà (import en
    // masse), on valide par lots : l'atomicité ne vaut alors que par lot.
    for (let i = 0; i < items.length; i += 100) {
      const lot = items.slice(i, i + 100)
      try {
        await this.client.send(new TransactWriteItemsCommand({ TransactItems: lot.map((x) => x.item) }))
      } catch (error) {
        if (error instanceof TransactionCanceledException) {
          const reasons = error.CancellationReasons ?? []
          const failed = reasons.findIndex((r) => r.Code === 'ConditionalCheckFailed')
          if (failed >= 0 && lot[failed]?.unique) throw uniqueViolation(lot[failed].unique as string)
          if (failed >= 0 || reasons.some((r) => r.Code === 'TransactionConflict')) throw writeConflict()
        }
        throw error
      }
    }
  }

  private uniqueKey(name: string, key: string): Record<string, AttributeValue> {
    return { pk: { S: this.pk('U', name) }, sk: { S: key } }
  }
}

let shared: DynamoDBClient | null = null

export function dynamoClient(): DynamoDBClient {
  shared ??= new DynamoDBClient({
    // DYNAMODB_REGION plutôt qu'AWS_REGION : Amplify réserve le préfixe AWS_.
    region: process.env.DYNAMODB_REGION ?? process.env.S3_REGION ?? process.env.AWS_REGION ?? 'eu-west-3',
    // DYNAMODB_ENDPOINT : uniquement pour DynamoDB Local (tests, poste).
    ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
  })
  return shared
}

/**
 * Crée la table si elle n'existe pas (facturation à la requête : on ne paie
 * que ce qu'on lit et écrit). Utilisé par les tests et scripts/creer-table.ts.
 */
export async function ensureTable(client: DynamoDBClient, table: string): Promise<'existante' | 'créée'> {
  const exists = await client.send(new DescribeTableCommand({ TableName: table })).then(
    () => true,
    (error: { name?: string }) => {
      if (error.name === 'ResourceNotFoundException') return false
      throw error
    },
  )
  if (exists) return 'existante'
  await client.send(
    new CreateTableCommand({
      TableName: table,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
    }),
  )
  await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName: table })
  return 'créée'
}
