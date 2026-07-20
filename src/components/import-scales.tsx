import {Button as PrimerButton, Flash, Text, Textarea} from '@primer/react'
import {Dialog} from '@primer/react/lib-esm/Dialog/Dialog'
import {keyBy} from 'lodash-es'
import {Upload} from 'lucide-react'
import React from 'react'
import {deserializePalette, previewFormat} from '../format'
import {PaletteFormat, Scale} from '../types'
import {Button} from './button'
import {HStack, VStack} from './stack'

type ImportScalesProps = {
  // The palette's import/export format (a preset or its Custom template).
  format: PaletteFormat | undefined
  onImport: (scales: Record<string, Scale>, replace: boolean) => void
}

export function ImportScales({format, onImport}: ImportScalesProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState('')
  const [replace, setReplace] = React.useState(false)
  const [fileName, setFileName] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  function loadFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      setCode(typeof reader.result === 'string' ? reader.result : '')
      setFileName(file.name)
      setError('')
    }
    reader.onerror = () => setError(`Couldn't read ${file.name}.`)
    reader.readAsText(file)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      const scales = deserializePalette(code, format)
      onImport(keyBy(scales, 'id'), replace)

      // Reset state
      setIsOpen(false)
      setCode('')
      setError('')
      setReplace(false)
      setFileName('')
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError(String(error))
      }
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Import</Button>
      {isOpen ? (
        <Dialog title="Import" onClose={() => setIsOpen(false)}>
          <form onSubmit={handleSubmit}>
            <VStack spacing={16}>
              {error ? <Flash variant="danger">{error}</Flash> : null}
              <VStack spacing={4} style={{width: '100%'}}>
                <HStack spacing={8} style={{width: '100%', justifyContent: 'space-between'}}>
                  <label htmlFor="code" style={{fontSize: 14}}>
                    Paste JSON
                  </label>
                  <PrimerButton
                    type="button"
                    size="small"
                    leadingVisual={Upload}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload .json
                  </PrimerButton>
                </HStack>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  style={{display: 'none'}}
                  onChange={event => {
                    const file = event.target.files?.[0]
                    if (file) loadFile(file)
                    // Allow re-selecting the same file.
                    event.target.value = ''
                  }}
                />
                <Textarea
                  id="code"
                  rows={12}
                  sx={{fontFamily: 'mono', width: '100%'}}
                  placeholder={previewFormat(format)}
                  value={code}
                  onChange={event => setCode(event.target.value)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    const file = event.dataTransfer.files?.[0]
                    if (file) {
                      event.preventDefault()
                      loadFile(file)
                    }
                  }}
                />
                {fileName ? <Text sx={{fontSize: 0, color: 'fg.muted', width: '100%'}}>Loaded {fileName}</Text> : null}
              </VStack>
              <HStack spacing={4}>
                <input
                  type="checkbox"
                  id="replace"
                  checked={replace}
                  onChange={event => setReplace(event.target.checked)}
                />
                <label htmlFor="replace" style={{fontSize: 14, lineHeight: 1}}>
                  Replace existing scales
                </label>
              </HStack>
              <PrimerButton type="submit">Import</PrimerButton>
            </VStack>
          </form>
        </Dialog>
      ) : null}
    </>
  )
}
