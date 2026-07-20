import {ThemeProvider} from '@primer/react'
import {render, screen} from '@testing-library/react'
import React from 'react'
import {App} from './app'
import {GlobalStateProvider} from './global-state'

test('renders the home page without crashing', async () => {
  render(
    <ThemeProvider colorMode="auto">
      <GlobalStateProvider>
        <App />
      </GlobalStateProvider>
    </ThemeProvider>
  )

  // The provider hydrates its state asynchronously, so wait for the home route
  // to mount. The header title is present there (matched via the /prism basename).
  expect(await screen.findByRole('heading', {name: 'Nectary Prism', level: 1})).toBeInTheDocument()
})
