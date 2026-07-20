import {IDBFactory} from 'fake-indexeddb'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'

// storage.ts probes `indexedDB` and opens its store at import time, so each case
// gets a fresh module bound to a fresh (or absent) IndexedDB. `idb: false`
// removes the global to exercise the localStorage fallback path.
async function freshStorage({idb}: {idb: boolean}) {
  vi.resetModules()
  if (idb) {
    globalThis.indexedDB = new IDBFactory()
  } else {
    // @ts-expect-error force the fallback branch
    delete globalThis.indexedDB
  }
  return import('./storage')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  // @ts-expect-error clean up between cases
  delete globalThis.indexedDB
})

test('persists and reloads a value through IndexedDB', async () => {
  const {persistState, flushPersist, loadPersistedState} = await freshStorage({idb: true})

  persistState('palette-A')
  await flushPersist()

  expect(await loadPersistedState()).toBe('palette-A')
  // The blob lives in IDB, not localStorage.
  expect(localStorage.getItem('global_state')).toBeNull()
})

test('coalesced writes keep only the latest value', async () => {
  const {persistState, flushPersist, loadPersistedState} = await freshStorage({idb: true})

  persistState('1')
  persistState('2')
  persistState('3')
  await flushPersist()

  expect(await loadPersistedState()).toBe('3')
})

test('migrates a legacy localStorage blob into IDB once, then drops the old key', async () => {
  const {loadPersistedState} = await freshStorage({idb: true})
  localStorage.setItem('global_state', 'legacy-blob')

  // First load returns the migrated value and clears the old key.
  expect(await loadPersistedState()).toBe('legacy-blob')
  expect(localStorage.getItem('global_state')).toBeNull()

  // Second load now comes from IDB — the migration stuck.
  expect(await loadPersistedState()).toBe('legacy-blob')
})

test('falls back to localStorage when IndexedDB is unavailable', async () => {
  const {persistState, flushPersist, loadPersistedState} = await freshStorage({idb: false})

  persistState('no-idb')
  await flushPersist()

  expect(localStorage.getItem('global_state')).toBe('no-idb')
  expect(await loadPersistedState()).toBe('no-idb')
})

test('requestPersistentStorage asks only when not already persisted', async () => {
  const {requestPersistentStorage} = await freshStorage({idb: true})

  const persist = vi.fn(async () => true)

  const define = (storage: unknown) => Object.defineProperty(navigator, 'storage', {configurable: true, value: storage})

  // Not yet persisted -> it asks.
  define({persisted: async () => false, persist})
  await requestPersistentStorage()
  expect(persist).toHaveBeenCalledTimes(1)

  // Already persisted -> it doesn't ask again.
  persist.mockClear()
  define({persisted: async () => true, persist})
  await requestPersistentStorage()
  expect(persist).not.toHaveBeenCalled()

  // Unsupported browser -> best effort, no throw.
  persist.mockClear()
  define(undefined)
  await expect(requestPersistentStorage()).resolves.toBeUndefined()
})
