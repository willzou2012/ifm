import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { defaultConfig, rawDir, rawFile } from '@/__tests__/helpers'
import { decorateItem } from '@/utils/files'
import { filterItems, pageCount, paginate, sortItems, useTableState } from '../useTableState'

const ctx = { config: defaultConfig, api: 'ifm.php', currentDir: '', isMobile: false }
const items = [
  rawDir('..'),
  rawDir('zeta', { owner: 'bob', group: 'b', lastmodified: 5 }),
  rawFile('file10.txt', { size_raw: 10, owner: 'carol', group: 'c', lastmodified: 1 }),
  rawFile('File2.txt', { size_raw: 300, owner: false, group: false, lastmodified: 3 }),
  rawFile('alpha.log', { size_raw: 20, owner: 'alice', group: 'a', lastmodified: 2 }),
].map((i) => decorateItem(i, ctx))
const names = (list: typeof items) => list.map((i) => i.name)

describe('sortItems', () => {
  it('keeps the server order without sort key', () => {
    expect(names(sortItems(items, null, 'asc'))).toEqual(names(items))
  })

  it('sorts naturally by name with the parent on top', () => {
    expect(names(sortItems(items, 'name', 'asc'))).toEqual([
      '..',
      'alpha.log',
      'File2.txt',
      'file10.txt',
      'zeta',
    ])
    expect(names(sortItems(items, 'name', 'desc'))).toEqual([
      '..',
      'zeta',
      'file10.txt',
      'File2.txt',
      'alpha.log',
    ])
  })

  it('sorts numerically by size and date', () => {
    expect(names(sortItems(items, 'size', 'desc'))).toEqual([
      '..',
      'File2.txt',
      'alpha.log',
      'file10.txt',
      'zeta',
    ])
    expect(names(sortItems(items, 'lastmodified', 'asc'))[1]).toBe('file10.txt')
  })

  it('sorts by owner and group', () => {
    expect(names(sortItems(items, 'owner', 'asc'))).toEqual([
      '..',
      'File2.txt',
      'alpha.log',
      'zeta',
      'file10.txt',
    ])
    expect(names(sortItems(items, 'group', 'desc'))[1]).toBe('file10.txt')
  })

  it('handles missing values', () => {
    const bare = [rawFile('b', { lastmodified: undefined, size_raw: undefined }), rawFile('a')].map(
      (i) => decorateItem(i, ctx),
    )
    expect(names(sortItems(bare, 'lastmodified', 'asc'))).toEqual(['b', 'a'])
    expect(names(sortItems(bare, 'size', 'asc'))).toEqual(['b', 'a'])
  })
})

describe('filterItems', () => {
  it('returns everything for an empty filter', () => {
    expect(filterItems(items, '  ')).toBe(items)
  })

  it('requires all words to match somewhere in the row', () => {
    expect(names(filterItems(items, 'TXT carol'))).toEqual(['..', 'file10.txt'])
    expect(names(filterItems(items, 'bob'))).toEqual(['..', 'zeta'])
    expect(names(filterItems(items, 'nothing'))).toEqual(['..'])
  })
})

describe('paging helpers', () => {
  it('computes pages', () => {
    expect(pageCount(0, 10)).toBe(1)
    expect(pageCount(21, 10)).toBe(3)
    expect(paginate([1, 2, 3, 4, 5], 1, 2)).toEqual([3, 4])
  })
})

describe('useTableState', () => {
  beforeEach(() => localStorage.clear())

  it('uses defaults and persists changes', async () => {
    const { state, toggleSort } = useTableState('key', { pageLength: 25 })
    expect(state).toMatchObject({
      sortKey: null,
      sortDir: 'asc',
      filter: '',
      page: 0,
      pageLength: 25,
    })
    toggleSort('name')
    expect(state).toMatchObject({ sortKey: 'name', sortDir: 'asc' })
    toggleSort('name')
    expect(state.sortDir).toBe('desc')
    toggleSort('size')
    expect(state).toMatchObject({ sortKey: 'size', sortDir: 'asc' })
    state.filter = 'x'
    await nextTick()
    expect(JSON.parse(localStorage.getItem('key')!)).toMatchObject({ sortKey: 'size', filter: 'x' })
  })

  it('restores the saved state', () => {
    localStorage.setItem('key', JSON.stringify({ sortKey: 'owner', sortDir: 'desc', filter: 'f' }))
    const { state } = useTableState('key')
    expect(state).toMatchObject({ sortKey: 'owner', sortDir: 'desc', filter: 'f', pageLength: 50 })
  })

  it('ignores broken or unavailable storage', async () => {
    localStorage.setItem('key', '{broken')
    const { state } = useTableState('key')
    expect(state.filter).toBe('')
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    try {
      state.filter = 'y'
      await nextTick()
    } finally {
      Storage.prototype.setItem = setItem
    }
    expect(state.filter).toBe('y')
  })
})
