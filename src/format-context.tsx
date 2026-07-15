import React from 'react'
import {DEFAULT_TEMPLATE, FORMAT_TEMPLATE_KEY} from './format'

type FormatTemplateContextValue = [string, (template: string) => void]

const FormatTemplateContext = React.createContext<FormatTemplateContextValue | null>(null)

function getPersistedTemplate(): string {
  try {
    return localStorage.getItem(FORMAT_TEMPLATE_KEY) || DEFAULT_TEMPLATE
  } catch {
    return DEFAULT_TEMPLATE
  }
}

export function FormatTemplateProvider({children}: {children: React.ReactNode}) {
  const [template, setTemplateState] = React.useState(getPersistedTemplate)

  const setTemplate = React.useCallback((next: string) => {
    setTemplateState(next)
    try {
      localStorage.setItem(FORMAT_TEMPLATE_KEY, next)
    } catch {
      // Ignore write failures (e.g. storage disabled); the in-memory value still updates.
    }
  }, [])

  const value = React.useMemo<FormatTemplateContextValue>(() => [template, setTemplate], [template, setTemplate])

  return <FormatTemplateContext.Provider value={value}>{children}</FormatTemplateContext.Provider>
}

export function useFormatTemplate(): FormatTemplateContextValue {
  const value = React.useContext(FormatTemplateContext)
  if (!value) {
    throw new Error('useFormatTemplate must be used within a FormatTemplateProvider')
  }
  return value
}
