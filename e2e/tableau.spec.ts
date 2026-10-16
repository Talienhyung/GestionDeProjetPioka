import { expect, test } from '@playwright/test'

async function seConnecter(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Identifiant').fill(username)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(/\/(accueil|profil)/)
}

test('un jeune écrit un billet, le corrige, puis le retire', async ({ page }) => {
  await seConnecter(page, 'tom', 'motdepasse-initial')

  await page.getByRole('link', { name: 'Tableau' }).click()
  await page.waitForURL(/\/tableau$/)

  await page.getByText('Écrire un billet').click()
  await page.getByPlaceholder('Titre (facultatif)').fill('Matériel')
  await page.getByPlaceholder('Une idée, une liste, un rappel').fill('tentes, réchaud')
  await page.getByRole('button', { name: 'Épingler au tableau' }).click()

  await expect(page.getByText('tentes, réchaud')).toBeVisible()
  await expect(page.getByText('Matériel')).toBeVisible()

  await page.getByRole('button', { name: 'modifier' }).click()
  await page.getByRole('textbox').last().fill('tentes, réchaud, trousse de secours')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('tentes, réchaud, trousse de secours')).toBeVisible()

  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'supprimer' }).click()
  await expect(page.getByText('tentes, réchaud, trousse de secours')).toHaveCount(0)
})

test('un jeune ne peut ni modifier ni épingler le billet d’un autre', async ({ page }) => {
  await seConnecter(page, 'nina', 'motdepasse-initial')
  await page.goto('/tableau')
  await page.getByText('Écrire un billet').click()
  await page.getByPlaceholder('Une idée, une liste, un rappel').fill('Billet de Nina')
  await page.getByRole('button', { name: 'Épingler au tableau' }).click()
  await expect(page.getByText('Billet de Nina')).toBeVisible()

  await seConnecter(page, 'tom', 'motdepasse-initial')
  await page.goto('/tableau')

  // On vise le billet de Nina, pas le tableau entier : Tom peut avoir les siens.
  const billetDeNina = page.locator('article').filter({ hasText: 'Billet de Nina' })
  await expect(billetDeNina).toBeVisible()
  await expect(billetDeNina.getByRole('button', { name: 'modifier' })).toHaveCount(0)
  await expect(billetDeNina.getByRole('button', { name: 'épingler' })).toHaveCount(0)
  await expect(billetDeNina.getByRole('button', { name: 'supprimer' })).toHaveCount(0)
})
