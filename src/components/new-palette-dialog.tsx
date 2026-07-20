import {Button as PrimerButton, Select, TextInput} from '@primer/react'
import {Dialog} from '@primer/react/lib-esm/Dialog/Dialog'
import React from 'react'
import {SCRATCH_TEMPLATE_ID, TemplateScales, getTemplateScales, templates} from '../templates'
import {VStack} from './stack'

// Primer's own inputs and buttons rather than the palette-flavored ones from
// ./button and ./input: the dialog portals to the end of the body, outside any
// card or editor, so the --color-* variables those read simply aren't there.
export function NewPaletteDialog({
  onClose,
  onCreate
}: {
  onClose: () => void
  onCreate: (name: string, scales: TemplateScales) => void
}) {
  const [name, setName] = React.useState('')
  const [templateId, setTemplateId] = React.useState(SCRATCH_TEMPLATE_ID)

  return (
    <Dialog title="New palette" onClose={onClose} width="small">
      <form
        onSubmit={event => {
          event.preventDefault()
          // An untouched name would fall back to "Untitled". When the palette is
          // seeded from a named template, borrow that template's label instead --
          // it's a better default than "Untitled". A name the user typed always
          // wins, and "Start from scratch" has no label to borrow so it's left
          // blank to fall back to "Untitled" as before.
          const trimmedName = name.trim()
          const template = templates.find(t => t.id === templateId)
          const paletteName = trimmedName || (templateId === SCRATCH_TEMPLATE_ID ? '' : template?.label ?? '')
          onCreate(paletteName, getTemplateScales(templateId))
        }}
      >
        <VStack spacing={16}>
          <VStack spacing={4} style={{width: '100%'}}>
            <label htmlFor="new-palette-name" style={{fontSize: 14}}>
              Name
            </label>
            {/* Submitting an empty field is allowed on purpose -- naming a
                palette is the kind of thing you do once you can see it, and the
                placeholder says what you get if you don't. */}
            <TextInput
              id="new-palette-name"
              autoFocus
              value={name}
              placeholder="Untitled"
              onChange={event => setName(event.target.value)}
              sx={{width: '100%'}}
            />
          </VStack>
          <VStack spacing={4} style={{width: '100%'}}>
            <label htmlFor="new-palette-template" style={{fontSize: 14}}>
              Template
            </label>
            {/* Seeds the palette with a ready-made set of scales. "Start from
                scratch" is the default -- a blank palette -- and the rest drop
                in a well-known system to edit from. */}
            <Select
              id="new-palette-template"
              value={templateId}
              onChange={event => setTemplateId(event.target.value)}
              sx={{width: '100%'}}
            >
              {templates.map(template => (
                <Select.Option key={template.id} value={template.id}>
                  {template.label}
                </Select.Option>
              ))}
            </Select>
          </VStack>
          <PrimerButton type="submit" variant="primary">
            Create palette
          </PrimerButton>
        </VStack>
      </form>
    </Dialog>
  )
}
