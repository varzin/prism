import {Button as PrimerButton, Flash, Text, Textarea} from '@primer/react'
import {Dialog} from '@primer/react/lib-esm/Dialog/Dialog'
import {Settings} from 'lucide-react'
import React from 'react'
import {useFormatTemplate} from '../format-context'
import {DEFAULT_TEMPLATE, PLACEHOLDERS, previewTemplate} from '../format'
import {IconButton} from './button'
import {VStack} from './stack'

export function FormatSettings() {
  const [template, setTemplate] = useFormatTemplate()
  const [isOpen, setIsOpen] = React.useState(false)
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
      <IconButton aria-label="Format settings" icon={() => <Settings size={16} />} onClick={open} />
      {isOpen ? (
        <Dialog
          title="Format settings"
          subtitle="Customize how scales import and export."
          width="xlarge"
          onClose={() => setIsOpen(false)}
        >
          <VStack spacing={16}>
            <VStack spacing={8} style={{width: '100%'}}>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%'}}>
                {PLACEHOLDERS.map(({token, description}) => (
                  <PrimerButton key={token} size="small" onClick={() => insertToken(token)} title={`Insert ${token}`}>
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
          </VStack>
        </Dialog>
      ) : null}
    </>
  )
}
