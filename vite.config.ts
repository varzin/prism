import react from '@vitejs/plugin-react'
import {defineConfig} from 'vitest/config'

// The app is deployed under the /prism/ path (GitHub Pages style).
// `build:preview` overrides this with --base=/ for root deploys.
export default defineConfig({
  base: '/prism/',
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      // Match the deploy base path so <BrowserRouter basename="/prism"> matches.
      jsdom: {url: 'http://localhost/prism/'}
    },
    setupFiles: './src/setupTests.ts'
  }
})
