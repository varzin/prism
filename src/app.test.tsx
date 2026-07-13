import {ThemeProvider} from '@primer/react'
import {render, screen} from '@testing-library/react'
import React from 'react'
import {App} from './app'
import {GlobalStateProvider} from './global-state'

test('renders the home page without crashing', () => {
  render(
    <ThemeProvider colorMode="auto">
      <GlobalStateProvider>
        <App />
      </GlobalStateProvider>
    </ThemeProvider>
  )

  // The header title is present on the home route (matched via the /prism basename).
  expect(screen.getByRole('heading', {name: 'Primer Prism', level: 1})).toBeInTheDocument()
})
