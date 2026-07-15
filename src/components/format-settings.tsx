import {Box, Button as PrimerButton, Flash, Text, Textarea} from '@primer/react'
import {Dialog} from '@primer/react/lib-esm/Dialog/Dialog'
import {Settings} from 'lucide-react'
import React from 'react'
import {useFormatTemplate} from '../format-context'
import {DEFAULT_TEMPLATE, PLACEHOLDERS, previewTemplate} from '../format'
import {IconButton} from './button'
import {VStack} from './stack'

const TABS = [
  {key: 'format', label: 'Format'},
  {key: 'keybindings', label: 'Keybindings'}
] as const

const KEYBINDING_GROUPS: {title: string; bindings: {keys: string; description: string}[]}[] = [
  {
    title: 'Panels',
    bindings: [
      {keys: '[ / ]', description: 'Move the active panel: left panel → scale view → right panel'},
      {keys: 'Shift + [', description: 'Show/hide the left panel'},
      {keys: 'Shift + ]', description: 'Show/hide the right panel'}
    ]
  },
  {
    title: 'Left panel',
    bindings: [{keys: '↑ / ↓', description: 'Switch to the previous/next scale, looping'}]
  },
  {
    title: 'Scale view',
    bindings: [
      {keys: '← / →', description: 'Switch to the previous/next point on the active curve'},
      {keys: '↑ / ↓', description: "Nudge the focused point's (or whole curve's) value"},
      {keys: 'Tab / Shift + Tab', description: 'Switch the active curve, looping (Hue ↔ Saturation ↔ Lightness)'}
    ]
  },
  {
    title: 'Anywhere on this page',
    bindings: [
      {
        keys: 'Alt/Opt + ↑ / ↓',
        description:
          "Switch to the previous/next scale, looping. Keeps the focused point selected if there was one, otherwise doesn't select anything"
      }
    ]
  },
  {
    title: 'Global',
    bindings: [
      {keys: 'Cmd/Ctrl + Z', description: 'Undo'},
      {keys: 'Cmd/Ctrl + Shift + Z', description: 'Redo'}
    ]
  }
]

export function FormatSettings() {
  const [template, setTemplate] = useFormatTemplate()
  const [isOpen, setIsOpen] = React.useState(false)
  const [tab, setTab] = React.useState<'format' | 'keybindings'>('format')
  const [draft, setDraft] = React.useState(template)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const {preview, error} = React.useMemo(() => {
    try {
      return {preview: previewTemplate(draft), error: ''}
    } catch (error) {
      return {preview: '', error: error instanceof Error ? error.message : String(error)}
    }
  }, [draft])

  function open() {
    setDraft(template)
    setTab('format')
    setIsOpen(true)
  }

  function save() {
    setTemplate(draft)
    setIsOpen(false)
  }

  // Insert a placeholder at the caret, keeping focus and caret position sensible.
  function insertToken(token: string) {
    const el = textareaRef.current
    const start = el?.selectionStart ?? draft.length
    const end = el?.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + token + draft.slice(end)
    setDraft(next)
    requestAnimationFrame(() => {
      el?.focus()
      const caret = start + token.length
      el?.setSelectionRange(caret, caret)
    })
  }

  return (
    <>
      <IconButton aria-label="Settings" icon={() => <Settings size={16} />} onClick={open} />
      {isOpen ? (
        <Dialog
          title="Settings"
          subtitle={
            tab === 'format' ? 'Customize how scales import and export.' : 'Reference for all keyboard shortcuts.'
          }
          width="xlarge"
          onClose={() => setIsOpen(false)}
        >
          <VStack spacing={16}>
            <Box
              role="tablist"
              sx={{display: 'flex', gap: 3, borderBottom: '1px solid var(--color-border, gainsboro)'}}
            >
              {TABS.map(({key, label}) => (
                <Box
                  key={key}
                  as="button"
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  sx={{
                    all: 'unset',
                    cursor: 'pointer',
                    padding: '8px 4px',
                    marginBottom: '-1px',
                    fontSize: 1,
                    fontWeight: tab === key ? 'bold' : 'normal',
                    color: 'var(--color-text)',
                    opacity: tab === key ? 1 : 0.7,
                    borderBottom: '2px solid',
                    borderColor: tab === key ? 'var(--color-accent-emphasis, #0969da)' : 'transparent',
                    '&:hover': {opacity: 1},
                    '&:focus-visible': {
                      outline: '2px solid var(--color-accent-emphasis, #0969da)',
                      outlineOffset: '2px',
                      borderRadius: 2
                    }
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>

            {tab === 'format' ? (
              <>
                <VStack spacing={8} style={{width: '100%'}}>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%'}}>
                    {PLACEHOLDERS.map(({token, description}) => (
                      <PrimerButton
                        key={token}
                        size="small"
                        onClick={() => insertToken(token)}
                        title={`Insert ${token}`}
                      >
                        <Text sx={{fontFamily: 'mono', fontSize: 0}}>{token}</Text>
                        <Text sx={{color: 'fg.muted', fontSize: 0, ml: 2}}>{description}</Text>
                      </PrimerButton>
                    ))}
                  </div>

                  <label htmlFor="format-template" style={{fontSize: 14, width: '100%'}}>
                    Format
                  </label>
                  <Textarea
                    id="format-template"
                    ref={textareaRef}
                    rows={12}
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    resize="vertical"
                    sx={{fontFamily: 'mono', width: '100%'}}
                  />
                </VStack>

                {error ? <Flash variant="danger">{error}</Flash> : null}

                <VStack spacing={4} style={{width: '100%'}}>
                  <Text sx={{fontSize: 0, color: 'fg.muted', width: '100%'}}>Preview</Text>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      maxHeight: 220,
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      lineHeight: 1.5,
                      border: '1px solid var(--borderColor-default, #d0d7de)',
                      borderRadius: 6,
                      background: 'var(--bgColor-muted, #f6f8fa)'
                    }}
                  >
                    {error ? 'Fix the format to see a preview.' : preview}
                  </pre>
                </VStack>

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%'}}>
                  <PrimerButton onClick={() => setDraft(DEFAULT_TEMPLATE)}>Reset to default</PrimerButton>
                  <PrimerButton variant="primary" onClick={save} disabled={Boolean(error)}>
                    Save
                  </PrimerButton>
                </div>
              </>
            ) : (
              <VStack spacing={16} style={{width: '100%'}}>
                {KEYBINDING_GROUPS.map(group => (
                  <VStack key={group.title} spacing={8} style={{width: '100%'}}>
                    <Text as="h3" sx={{fontWeight: 'bold', fontSize: 1, m: 0}}>
                      {group.title}
                    </Text>
                    {group.bindings.map(binding => (
                      <div
                        key={binding.keys}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '220px 1fr',
                          gap: 12,
                          alignItems: 'center',
                          width: '100%'
                        }}
                      >
                        <Text
                          as="code"
                          sx={{
                            fontFamily: 'mono',
                            fontSize: 0,
                            padding: '2px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--borderColor-default, #d0d7de)',
                            background: 'var(--bgColor-muted, #f6f8fa)',
                            justifySelf: 'start'
                          }}
                        >
                          {binding.keys}
                        </Text>
                        <Text sx={{fontSize: 1}}>{binding.description}</Text>
                      </div>
                    ))}
                  </VStack>
                ))}
              </VStack>
            )}
          </VStack>
        </Dialog>
      ) : null}
    </>
  )
}
