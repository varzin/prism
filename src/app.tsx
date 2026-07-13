import {BaseStyles, themeGet} from '@primer/react'
import React from 'react'
import {useHotkeys} from 'react-hotkeys-hook'
import {BrowserRouter, Route, Routes} from 'react-router-dom'
import {createGlobalStyle} from 'styled-components'
import {useGlobalState} from './global-state'
import {Index} from './pages'
import {Curve} from './pages/curve'
import {NotFound} from './pages/not-found'
import {Palette} from './pages/palette'
import {Scale} from './pages/scale'

const GlobalStyles = createGlobalStyle`
  body {
    background-color: ${themeGet('colors.canvas.default')};
  }
`

// The deploy base path (e.g. "/prism/") comes from Vite's configured `base`.
// react-router's basename expects it without a trailing slash.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export function App() {
  const [, send] = useGlobalState()

  useHotkeys('command+z, ctrl+z', () => send('UNDO'))
  useHotkeys('command+shift+z, ctrl+shift+z', () => send('REDO'))

  return (
    <BaseStyles>
      <GlobalStyles />
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="local/:paletteId" element={<Palette />}>
            <Route path="scale/:scaleId" element={<Scale />} />
            <Route path="curve/:curveId" element={<Curve />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </BaseStyles>
  )
}
