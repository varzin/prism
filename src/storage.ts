import {createStore, get as idbGet, set as idbSet, UseStore} from 'idb-keyval'

// Durable home for the app's global state (palettes + undo history).
//
// Why not localStorage: it caps at ~5 MB — a long undo history hit that ceiling
// and setItem threw mid-save — and it's first in line for automatic eviction
// under storage pressure. IndexedDB gives hundreds of MB of headroom and, paired
// with navigator.storage.persist(), asks the browser not to evict us at all.
//
// The state is a single JSON string, so a one-key blob store is all we need.
// Everything degrades to localStorage when IndexedDB is missing or blocked
// (private mode, older browsers, the jsdom test env), so the app never loses the
// ability to persist — it just loses the extra durability.

const STATE_KEY = 'global_state'

// createStore only *describes* the DB; it opens lazily on first get/set, so a
// blocked IndexedDB surfaces as a throw there, not here. Every op is guarded
// and falls back to localStorage, so one probe flag is enough to skip the work.
const idbSupported = typeof indexedDB !== 'undefined'
let store: UseStore | undefined
if (idbSupported) {
  try {
    store = createStore('prism', 'keyval')
  } catch {
    store = undefined
  }
}
const useIdb = idbSupported && store !== undefined

function localGet(): string | null {
  try {
    return localStorage.getItem(STATE_KEY)
  } catch {
    return null
  }
}

function localSet(value: string): void {
  try {
    localStorage.setItem(STATE_KEY, value)
  } catch {
    // Quota exceeded or storage disabled — nothing more we can do here.
  }
}

function localRemove(): void {
  try {
    localStorage.removeItem(STATE_KEY)
  } catch {
    // ignore
  }
}

// Reads the persisted blob, transparently migrating anyone whose data still
// lives under the old localStorage key into IndexedDB on first run.
export async function loadPersistedState(): Promise<string | null> {
  if (useIdb) {
    try {
      const fromIdb = await idbGet<string>(STATE_KEY, store)
      if (fromIdb != null) return fromIdb

      // Nothing in IDB yet: fold in the pre-IndexedDB localStorage blob once,
      // then drop it so there's a single source of truth going forward.
      const legacy = localGet()
      if (legacy != null) {
        await idbSet(STATE_KEY, legacy, store)
        localRemove()
        return legacy
      }
      return null
    } catch {
      // IDB failed at runtime — read whatever localStorage still holds.
      return localGet()
    }
  }
  return localGet()
}

// Writes queue through a single in-flight promise that always flushes the latest
// value: a burst of state changes collapses to one trailing write, and no write
// can clobber a newer one with stale data. Fire-and-forget for callers.
let inFlight: Promise<void> | null = null
let pending: string | null = null

export function persistState(serialized: string): void {
  pending = serialized
  if (!inFlight) inFlight = drain()
}

// Resolves once the queued write has flushed. Handy for tests and for a
// best-effort flush on pagehide.
export function flushPersist(): Promise<void> {
  return inFlight ?? Promise.resolve()
}

async function drain(): Promise<void> {
  try {
    while (pending != null) {
      const next = pending
      pending = null
      await writeOnce(next)
    }
  } finally {
    inFlight = null
  }
}

async function writeOnce(value: string): Promise<void> {
  if (useIdb) {
    try {
      await idbSet(STATE_KEY, value, store)
      return
    } catch {
      // fall through to the localStorage mirror
    }
  }
  localSet(value)
}

// Asks the browser to keep our storage out of the automatic-eviction pool.
// Silent and idempotent on Chrome; Firefox may prompt, so only ask when we're
// not already persisted. Best effort — unsupported browsers just skip it.
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && navigator.storage.persisted) {
      const already = await navigator.storage.persisted()
      if (!already) await navigator.storage.persist()
    }
  } catch {
    // not supported — the app works fine without it
  }
}
