/**
 * Crée la table DynamoDB du site si elle n'existe pas encore.
 *   DYNAMODB_TABLE=notre-cap DYNAMODB_REGION=eu-west-3 npx tsx scripts/creer-table.ts
 * (avec AWS_PROFILE pour choisir le compte). Facturation à la requête : la
 * table ne coûte rien quand personne ne s'en sert.
 */
import { dynamoClient, ensureTable } from '../src/lib/data/dynamoBackend'

const table = process.env.DYNAMODB_TABLE
if (!table) {
  console.error('Définis DYNAMODB_TABLE.')
  process.exit(1)
}
ensureTable(dynamoClient(), table).then(
  (etat) => console.log(`Table « ${table} » : ${etat}.`),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)
