import {Button as PrimerButton, Textarea} from '@primer/react'
import {Dialog} from '@primer/react/lib-esm/Dialog/Dialog'
import {readableColor} from 'color2k'
import copy from 'copy-to-clipboard'
import {camelCase} from 'lodash-es'
import React from 'react'
import {Palette} from '../types'
import {colorToHex, getColor, getColorName} from '../utils'
import {Button} from './button'
import {VStack} from './stack'

type ExportScalesProps = {
  palette: Palette
}

// Each color carries its display name, so the exported JSON round-trips through
// import and the SVG thumbnail can label every swatch.
type NamedColor = {name: string; value: string}

export function ExportScales({palette}: ExportScalesProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const namedScales = React.useMemo(
    () =>
      Object.values(palette.scales).reduce<Record<string, NamedColor[]>>((acc, scale) => {
        let key = camelCase(scale.name)
        let i = 1

        while (key in acc) {
          i++
          key = `${camelCase(scale.name)}${i}`
        }

        acc[key] = scale.colors.map((_, index) => ({
          name: getColorName(scale.colors, index),
          value: colorToHex(getColor(palette.curves, scale, index))
        }))
        return acc
      }, {}),
    [palette.curves, palette.scales]
  )

  const code = React.useMemo(() => JSON.stringify(namedScales, null, 2), [namedScales])

  const svg = React.useMemo(() => generateSvg(namedScales), [namedScales])

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Export</Button>
      {isOpen ? (
        <Dialog title="Export" onClose={() => setIsOpen(false)}>
          <VStack spacing={16}>
            <Textarea
              aria-label="Copy JSON"
              rows={16}
              value={code}
              readOnly
              resize="vertical"
              sx={{fontFamily: 'mono'}}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16
              }}
            >
              <PrimerButton onClick={() => copy(code)}>Copy JSON</PrimerButton>
              <PrimerButton onClick={() => copy(svg)}>Copy SVG</PrimerButton>
            </div>
          </VStack>
        </Dialog>
      ) : null}
    </>
  )
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, char => {
    switch (char) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function generateSvg(scales: Record<string, NamedColor[]>) {
  const rectWidth = 200
  const rectHeight = 50

  const width = Object.values(scales).length * rectWidth
  const height = Object.values(scales).reduce((acc, colors) => Math.max(colors.length, acc), 0) * rectHeight

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${Object.entries(scales).map(([key, colors], index) => {
    return `<g id="${escapeXml(key)}">
    ${colors
      .map(({name, value}, i) => {
        const x = index * rectWidth
        const y = i * rectHeight
        // Pick black or white for the label so it stays legible on any swatch.
        const textColor = readableColor(value)
        return `<rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" fill="${value}"/><text x="${
          x + 12
        }" y="${
          y + rectHeight / 2
        }" fill="${textColor}" font-family="sans-serif" font-size="13" font-weight="bold" dominant-baseline="middle">${escapeXml(
          name
        )}</text>`
      })
      .join('')}
  </g>`
  })}
</svg>`
}
