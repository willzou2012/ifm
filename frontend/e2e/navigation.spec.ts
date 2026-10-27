import { expect, test } from '@playwright/test'
import { itemLink, openIfm, row } from './helpers'

test('lists files without errors', async ({ page }) => {
  const errors = await openIfm(page)
  for (const name of ['docs', 'target', 'readme.txt', 'data.json', 'pixel.png'])
    await expect(itemLink(page, name)).toBeVisible()
  // the IFM script itself is hidden
  await expect(itemLink(page, 'ifm.php')).toHaveCount(0)
  await expect(page.locator('.ifminfo')).toContainText('IFM - improved file manager')
  expect(errors).toEqual([])
})

test('navigates into directories and back with the browser history', async ({ page }) => {
  await openIfm(page)
  await itemLink(page, 'docs').click()
  await expect(itemLink(page, 'notes.md')).toBeVisible()
  await expect(page).toHaveURL(/#docs$/)
  await expect(page.locator('#currentDir')).toHaveValue('docs')

  await itemLink(page, '..').click()
  await expect(itemLink(page, 'readme.txt')).toBeVisible()

  await page.goBack()
  await expect(itemLink(page, 'notes.md')).toBeVisible()
})

test('opens the directory given in the URL hash', async ({ page }) => {
  await page.goto('/ifm.php#docs%2Fdeep')
  await expect(itemLink(page, 'needle.txt')).toBeVisible()
})

test('changes the directory via the path input', async ({ page }) => {
  await openIfm(page)
  await page.fill('#currentDir', 'docs/deep')
  await page.press('#currentDir', 'Enter')
  await expect(itemLink(page, 'needle.txt')).toBeVisible()
})

test('supports keyboard navigation', async ({ page }) => {
  await openIfm(page)
  await page.keyboard.press('j')
  await expect(row(page, 'docs')).toHaveClass(/highlightedItem/)
  await page.keyboard.press('j')
  await expect(row(page, 'target')).toHaveClass(/highlightedItem/)
  await page.keyboard.press('k')
  await expect(row(page, 'docs')).toHaveClass(/highlightedItem/)
  await page.keyboard.press('Enter')
  await expect(itemLink(page, 'notes.md')).toBeVisible()
  await page.keyboard.press('h')
  await expect(itemLink(page, 'readme.txt')).toBeVisible()
})

test('filters and sorts the file table', async ({ page }) => {
  await openIfm(page)
  await page.fill('input[name="filter"]', 'json')
  await expect(page.locator('#filetable tbody tr')).toHaveCount(1)
  await expect(itemLink(page, 'data.json')).toBeVisible()
  await page.fill('input[name="filter"]', '')

  await page.click('th.th-size')
  await page.click('th.th-size')
  // descending by size: the 4 KB log file comes first
  await expect(page.locator('#filetable tbody tr').first()).toHaveAttribute(
    'data-filename',
    'big.log',
  )
  await page.click('th.th-filename')
  await expect(page.locator('#filetable tbody tr').first()).toHaveAttribute(
    'data-filename',
    'big.log',
  )
})

test('selects rows with ctrl+click and shows the context menu', async ({ page }) => {
  await openIfm(page)
  await row(page, 'readme.txt')
    .locator('td.td-size')
    .click({ modifiers: ['Control'] })
  await row(page, 'data.json')
    .locator('td.td-size')
    .click({ modifiers: ['Control'] })
  await expect(page.locator('#filetable tr.selectedItem')).toHaveCount(2)

  await itemLink(page, 'data.json').click({ button: 'right' })
  const menu = page.locator('.ifm-context-menu')
  await expect(menu).toBeVisible()
  await expect(menu.locator('[data-action="delete"] .badge')).toHaveText('2')
  await expect(menu.locator('[data-action="rename"]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
})

test('shows an image preview on hover', async ({ page }) => {
  await openIfm(page)
  await itemLink(page, 'pixel.png').hover()
  await expect(page.locator('.ifm-image-preview img')).toHaveAttribute('src', 'pixel.png')
})
