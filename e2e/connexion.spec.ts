// e2e/connexion.spec.ts
import { expect, test } from '@playwright/test'

test('un jeune se connecte, change son mot de passe et arrive sur l accueil', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Identifiant').fill('lucie')
  await page.getByLabel('Mot de passe').fill('motdepasse-initial')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await page.waitForURL(/\/profil\/mot-de-passe/)
  await page.getByPlaceholder('Mot de passe actuel').fill('motdepasse-initial')
  await page.getByPlaceholder('Nouveau mot de passe').fill('nouveau-mdp-2027')
  await page.getByPlaceholder('Confirme le nouveau').fill('nouveau-mdp-2027')
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(page).toHaveURL(/\/accueil/)
})

test('un mauvais mot de passe affiche un message et ne connecte pas', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Identifiant').fill('lucie')
  await page.getByLabel('Mot de passe').fill('faux')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page.locator('p[role="alert"]')).toContainText('incorrect')
  await expect(page).toHaveURL(/\/login/)
})
