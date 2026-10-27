import { expect, test } from '@playwright/test'
import { itemLink } from './helpers'

test.use({ baseURL: 'http://127.0.0.1:8098' })

test('requires a login and allows logging out', async ({ page }) => {
  await page.goto('/ifm.php')
  await expect(page.locator('#loginForm')).toBeVisible()
  // the login dialog cannot be dismissed
  await page.keyboard.press('Escape')
  await expect(page.locator('#loginForm')).toBeVisible()

  await page.fill('#inputLogin', 'admin')
  await page.fill('#inputPassword', 'wrong')
  await page.click('#buttonLogin')
  await expect(page.locator('#loginForm .alert')).toContainText('Wrong credentials')

  await page.fill('#inputPassword', 'admin')
  await page.click('#buttonLogin')
  await expect(itemLink(page, 'readme.txt')).toBeVisible()

  // state-changing requests carry the CSRF token of the session
  await page.click('#createDir')
  await page.fill('#dirname', 'auth-dir')
  await page.press('#dirname', 'Enter')
  await expect(itemLink(page, 'auth-dir')).toBeVisible()

  await page.click('#buttonLogout')
  await expect(page.locator('#loginForm')).toBeVisible()
})
