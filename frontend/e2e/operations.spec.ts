import { expect, test } from '@playwright/test'
import { createFile, expectNotification, itemLink, openIfm, row } from './helpers'

test('creates and deletes a directory', async ({ page }) => {
  await openIfm(page)
  await page.click('#createDir')
  await page.fill('#dirname', 'docs')
  await page.click('#formCreateDir #buttonSave')
  await expect(page.locator('#dirnameError')).toHaveText('This name is already taken.')

  await page.fill('#dirname', 'e2e-dir')
  await page.press('#dirname', 'Enter')
  await expectNotification(page, 'Directory created.')
  await expect(itemLink(page, 'e2e-dir')).toBeVisible()

  await row(page, 'e2e-dir').locator('a[name="do-delete"]').click()
  await expect(page.locator('#formDeleteFiles code')).toHaveText('e2e-dir')
  await page.click('#buttonYes')
  await expectNotification(page, 'Files deleted.')
  await expect(itemLink(page, 'e2e-dir')).toHaveCount(0)
})

test('creates, edits and renames a file', async ({ page }) => {
  await openIfm(page)
  await createFile(page, 'e2e-edit.txt', 'first version')

  await row(page, 'e2e-edit.txt').locator('a[name="do-edit"]').click()
  await expect(page.locator('#content .ace_content')).toContainText('first version')
  // unsaved changes prevent closing the dialog with Escape
  await page.locator('#content textarea').fill('second version')
  await page.keyboard.press('Escape')
  await expect(page.locator('#formFile')).toBeVisible()
  await page.click('#buttonSaveNotClose')
  await expectNotification(page, 'File saved.')
  await page.click('#buttonClose')

  await row(page, 'e2e-edit.txt').locator('a[name="do-rename"]').click()
  await page.fill('#newname', 'e2e-renamed.txt')
  await page.press('#newname', 'Enter')
  await expectNotification(page, 'File renamed.')
  await expect(itemLink(page, 'e2e-renamed.txt')).toBeVisible()

  await itemLink(page, 'e2e-renamed.txt').click({ button: 'right' })
  await page.click('.ifm-context-menu [data-action="edit"]')
  await expect(page.locator('#content .ace_content')).toContainText('second version')
  await page.click('#buttonClose')
})

test('uploads files with overwrite confirmation', async ({ page }) => {
  await openIfm(page)
  await page.click('#upload')
  await page.setInputFiles('#fileselect', {
    name: 'e2e-upload.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('uploaded'),
  })
  await expect(page.locator('#uploadFileList li')).toHaveCount(1)
  await page.click('#buttonUpload')
  await expectNotification(page, 'File uploaded.')
  await expect(itemLink(page, 'e2e-upload.txt')).toBeVisible()

  await page.click('#upload')
  await page.setInputFiles('#fileselect', {
    name: 'e2e-upload.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('uploaded again'),
  })
  await page.click('#buttonUpload')
  await expect(page.locator('#formUploadConfirmOverwrite li')).toHaveText('e2e-upload.txt')
  await page.click('#buttonConfirm')
  await expectNotification(page, 'File uploaded.')
})

test('changes permissions', async ({ page }) => {
  await openIfm(page)
  await createFile(page, 'e2e-perms.txt', 'x')
  const input = row(page, 'e2e-perms.txt').locator('input[name="newpermissions"]')
  await input.fill('rwxr-x---')
  await input.press('Enter')
  await expectNotification(page, 'Permissions changed.')
  await expect(input).toHaveValue('rwx r-x ---')
})

test('copies and moves files with the folder tree', async ({ page }) => {
  await openIfm(page)
  await createFile(page, 'e2e-copy.txt', 'copy me')

  await row(page, 'e2e-copy.txt').locator('a[name="do-copymove"]').click()
  await page.locator('#copyMoveTree li', { hasText: 'target' }).click()
  await page.click('#copyButton')
  await expectNotification(page, 'Files copied.')

  await row(page, 'e2e-copy.txt').locator('a[name="do-copymove"]').click()
  const docs = page.locator('#copyMoveTree li', { hasText: 'docs' })
  await docs.locator('.expand-icon').click()
  await page.locator('#copyMoveTree li', { hasText: 'deep' }).click()
  await page.click('#moveButton')
  await expectNotification(page, 'Files moved.')
  await expect(itemLink(page, 'e2e-copy.txt')).toHaveCount(0)

  await itemLink(page, 'target').click()
  await expect(itemLink(page, 'e2e-copy.txt')).toBeVisible()
})

test('creates and extracts an archive', async ({ page }) => {
  await openIfm(page)
  await itemLink(page, 'readme.txt').click({ button: 'right' })
  await page.click('.ifm-context-menu [data-action="createarchive"]')
  await page.fill('#archivename', 'e2e-archive.rar')
  await page.press('#archivename', 'Enter')
  await expectNotification(page, /Invalid archive format/)

  await page.fill('#archivename', 'e2e-archive.zip')
  await page.press('#archivename', 'Enter')
  await expectNotification(page, 'Archive created.')
  await expect(itemLink(page, 'e2e-archive.zip')).toBeVisible()

  await row(page, 'e2e-archive.zip').locator('a[name="do-extract"]').click()
  await page.locator('#formExtractFile input[placeholder="e2e-archive"]').click()
  await page.click('#buttonExtract')
  await expectNotification(page, 'Archive extracted.')
  await itemLink(page, 'e2e-archive').click()
  await expect(itemLink(page, 'readme.txt')).toBeVisible()
})

test('searches files recursively', async ({ page }) => {
  await openIfm(page)
  await page.keyboard.press('/')
  await page.fill('#searchPattern', 'needle*')
  await page.press('#searchPattern', 'Enter')
  const result = page.locator('#searchResults a.searchitem')
  await expect(result).toContainText('needle.txt')
  await result.click()
  await expect(itemLink(page, 'needle.txt')).toBeVisible()
  await expect(page.locator('#currentDir')).toHaveValue('docs/deep')
})

test('performs AJAX requests', async ({ page }) => {
  await openIfm(page)
  await page.click('#buttonAjaxRequest')
  await page.fill('#ajaxurl', 'http://127.0.0.1:8099/ifm.php')
  await page.fill('#ajaxdata', 'api=getI18N')
  await page.click('#buttonRequest')
  await expect(page.locator('#ajaxStatusCode')).toHaveText('200')
  await expect(page.locator('#ajaxresponse')).toHaveValue(/"upload_drop"/)
})
