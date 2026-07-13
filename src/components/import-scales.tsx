import {Button as PrimerButton, Flash, Textarea} from '@primer/react'
import {Dialog} from '@primer/react/lib-esm/Dialog/Dialog'
import {isArray, keyBy} from 'lodash-es'
import React from 'react'
import {v4 as uniqueId} from 'uuid'
import {Color, Scale} from '../types'
import {getColorName, hexToColor} from '../utils'
import {Button} from './button'
import {HStack, VStack} from './stack'

const PLACEHOLDER = `{
  "gray": [
    { "name": "10", "value": "#eee" },
    { "name": "20", "value": "#ddd" },
    { "name": "30", "value": "#ccc" }
  ]
}`

// A single color in imported JSON: either a bare hex string (legacy) or a
// {name, value} object.
type ImportedColor = string | {name?: string | number; value: string}

type ImportScalesProps = {
  onImport: (scales: Record<string, Scale>, replace: boolean) => void
}

export function ImportScales({onImport}: ImportScalesProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState('')
  const [replace, setReplace] = React.useState(false)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      const parsedCode: Record<string, ImportedColor | ImportedColor[]> = JSON.parse(code)

      const scales: Scale[] = Object.entries(parsedCode).map(([name, scale]) => {
        const id = uniqueId()
        const scaleArray = isArray(scale) ? scale : [scale]

        if (scaleArray.length === 0) {
          throw new Error(`Please provide at least one color for ${name} scale`)
        }

        const colors: Color[] = scaleArray.map((entry, index) => {
          // Legacy shape: a bare hex string. Name defaults to the step-of-10 scheme.
          if (typeof entry === 'string') {
            return {...hexToColor(entry), name: getColorName([], index)}
          }

          if (!entry || typeof entry.value !== 'string') {
            throw new Error(`Each color in ${name} needs a "value" hex string`)
          }

          return {
            ...hexToColor(entry.value),
            name: entry.name != null ? String(entry.name) : getColorName([], index)
          }
        })

        return {id, name, colors, curves: {}}
      })

      onImport(keyBy(scales, 'id'), replace)

      // Reset state
      setIsOpen(false)
      setCode('')
      setError('')
      setReplace(false)
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
              <VStack spacing={4}>
                <label htmlFor="code" style={{fontSize: 14}}>
                  Paste JSON
                </label>
                <Textarea
                  id="code"
                  rows={12}
                  sx={{fontFamily: 'mono'}}
                  placeholder={PLACEHOLDER}
                  value={code}
                  onChange={event => setCode(event.target.value)}
                />
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
              <PrimerButton>Import</PrimerButton>
            </VStack>
          </form>
        </Dialog>
      ) : null}
    </>
  )
}
