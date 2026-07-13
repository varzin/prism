// jest-dom adds custom matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest'

// jsdom does not implement CSS.supports, which @primer/react calls at module
// scope (PageLayout). Provide a minimal stub so components can be rendered.
if (typeof CSS === 'undefined') {
  // @ts-expect-error - minimal stub for the test environment
  globalThis.CSS = {supports: () => false}
} else if (typeof CSS.supports !== 'function') {
  CSS.supports = () => false
}

// Node 25 exposes an experimental global `localStorage` that throws unless a
// backing file is configured, shadowing jsdom's. Replace it with a working
// in-memory implementation so the state machine can persist during tests.
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    }
  }
})
