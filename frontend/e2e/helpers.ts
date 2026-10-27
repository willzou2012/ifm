import { expect, type Page } from '@playwright/test'

export const row = (page: Page, name: string) =>
  page.locator(`#filetable tbody tr[data-filename="${name}"]`)

export const itemLink = (page: Page, name: string) =>
  page.locator(`#filetable a.ifmitem[data-name="${name}"]`)

/** Opens IFM and waits until the file table is loaded. */
export async function openIfm(page: Page, path = '/ifm.php') {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(path)
  await expect(itemLink(page, 'readme.txt').or(page.locator('#loginForm'))).toBeVisible()
  return errors
}

/** Expects a notification and closes it, so it does not cover other elements. */
export async function expectNotification(page: Page, text: string | RegExp) {
  const notification = page.locator('.ifm-notification').filter({ hasText: text }).first()
  await expect(notification).toBeVisible()
  await notification.locator('button.close').click()
}

/** Creates a file through the "new file" dialog of the editor. */
export async function createFile(page: Page, name: string, content: string) {
  await page.click('#createFile')
  await page.fill('#formFile input[name="filename"]', name)
  await page.locator('#content textarea').fill(content)
  await page.click('#buttonSaveNotClose')
  await expectNotification(page, 'File saved.')
  await page.click('#buttonClose')
  await expect(itemLink(page, name)).toBeVisible()
}
