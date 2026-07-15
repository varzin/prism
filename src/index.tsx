import {ThemeProvider} from '@primer/react'
import React from 'react'
import ReactDOM from 'react-dom'
import {App} from './app'
import {FormatTemplateProvider} from './format-context'
import {GlobalStateProvider} from './global-state'
import './index.css'

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider colorMode="auto">
      <GlobalStateProvider>
        <FormatTemplateProvider>
          <App />
        </FormatTemplateProvider>
      </GlobalStateProvider>
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
