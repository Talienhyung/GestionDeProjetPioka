// e2e/parcours-cap.spec.ts
import { expect, test } from '@playwright/test'

async function seConnecter(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Identifiant').fill(username)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  // Sans cette attente, le test enchaîne avant que le cookie de session soit posé.
  await page.waitForURL(/\/(accueil|profil)/)
}

test('inscription, soumission, refus, correction, validation et points', async ({ page }) => {
  // Le jeune prend une tâche et la rend.
  await seConnecter(page, 'tom', 'motdepasse-initial')
  await page.getByRole('link', { name: 'Le CAP' }).click()
  await page.waitForURL(/\/cap$/)
  await page.getByRole('link', { name: /Établir le budget prévisionnel/ }).first().click()
  await page.getByRole('button', { name: "Je m'inscris" }).click()
  await expect(page.getByText('Tom')).toBeVisible()

  await page.getByPlaceholder('Raconte ce que tu as fait').fill('Budget prêt, voir le tableau.')
  await page.getByLabel(/Photos/).setInputFiles('e2e/fixtures/photo.jpg')
  await page.getByRole('button', { name: 'Soumettre aux chefs' }).click()
  await expect(page.getByText('En attente de la réponse')).toBeVisible()

  // La photo doit réellement se charger dans le navigateur, pas seulement
  // exister en base : naturalWidth à 0 signifie image cassée.
  const photo = page.getByRole('img').first()
  await expect(photo).toBeVisible()
  await expect
    .poll(async () => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)

  // Le chef refuse avec un commentaire.
  await seConnecter(page, 'sarah', 'chef-mdp-2027')
  await page.getByRole('link', { name: 'Valider' }).click()
  await page.getByPlaceholder('Commentaire').fill('Il manque les recettes.')
  await page.getByRole('button', { name: 'À corriger' }).click()
  // La soumission quitte la file : la carte disparaît avec son message.
  await expect(page.getByText('Rien en attente')).toBeVisible()

  // Le jeune corrige et resoumet.
  await seConnecter(page, 'tom', 'motdepasse-initial')
  await page.getByRole('link', { name: 'Le CAP' }).click()
  await page.waitForURL(/\/cap$/)
  await page.getByRole('link', { name: /Établir le budget prévisionnel/ }).first().click()
  await expect(page.getByText('Il manque les recettes.')).toBeVisible()
  await page.getByPlaceholder('Raconte ce que tu as fait').fill('Recettes ajoutées.')
  await page.getByRole('button', { name: 'Soumettre aux chefs' }).click()
  // Attendre que la re-soumission soit enregistrée avant de changer de compte.
  await expect(page.getByText('En attente de la réponse')).toBeVisible()

  // Le chef valide avec un bonus.
  await seConnecter(page, 'sarah', 'chef-mdp-2027')
  await page.getByRole('link', { name: 'Valider' }).click()
  await page.waitForURL(/\/validation/)
  await page.getByLabel(/Bonus/).fill('10')
  await page.getByRole('button', { name: 'Valider' }).last().click()
  await expect(page.getByText('Rien en attente')).toBeVisible()

  // Le jeune voit ses points et son badge.
  await seConnecter(page, 'tom', 'motdepasse-initial')
  // 50 (difficile, seul) + 10 de bonus + 5 (Premier pas) + 10 (Costaud)
  await expect(page.getByText('75 points')).toBeVisible()
  // « Premier pas » apparaît aussi dans les notifications : on vise la vitrine.
  await expect(page.getByText('Premier pas').first()).toBeVisible()
})

test('un jeune ne voit pas la file de validation', async ({ page }) => {
  await seConnecter(page, 'tom', 'motdepasse-initial')
  await expect(page.getByRole('link', { name: 'Valider' })).toHaveCount(0)

  await page.goto('/validation')
  await expect(page).toHaveURL(/\/accueil/)
})
