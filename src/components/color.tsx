import {Box} from '@primer/react'
import {parseToRgba, toHsla} from 'color2k'
import {Check, ChevronDown, Copy, Trash2} from 'lucide-react'
import React from 'react'
import {useGlobalState} from '../global-state'
import {Color as ColorType} from '../types'
import {colorToHex, getColorName} from '../utils'
import {icon16, IconButton} from './button'
import {Input} from './input'
import {SidebarPanel} from './sidebar-panel'
import {VStack} from './stack'

const COLOR_FORMAT_KEY = 'color-tool:color-format'

const COLOR_FORMATS = [
  {key: 'hex', label: 'HEX'},
  {key: 'rgb', label: 'sRGB'},
  {key: 'hsl', label: 'HSL'},
  {key: 'hsluv', label: 'HSLuv'}
] as const

type ColorFormat = typeof COLOR_FORMATS[number]['key']

function getPersistedFormat(): ColorFormat {
  try {
    const stored = localStorage.getItem(COLOR_FORMAT_KEY)
    if (stored && COLOR_FORMATS.some(format => format.key === stored)) {
      return stored as ColorFormat
    }
  } catch {
    // Ignore read failures (e.g. storage disabled).
  }
  return 'hex'
}

function formatColor(format: ColorFormat, color: ColorType, hex: string): string {
  switch (format) {
    case 'rgb': {
      const [r, g, b] = parseToRgba(hex)
      return `rgb(${r}, ${g}, ${b})`
    }
    case 'hsl':
      return toHsla(hex)
        .replace(/^hsla/, 'hsl')
        .replace(/,\s*[\d.]+\)$/, ')')
    case 'hsluv':
      return `hsluv(${color.hue}, ${color.saturation}%, ${color.lightness}%)`
    case 'hex':
    default:
      return hex
  }
}

// A monospace code box with a transparent format picker in the top-left corner
// and a transparent copy button in the top-right. The chosen format persists in
// localStorage so it sticks across colors and sessions.
function ColorCodeSnippet({color, hex}: {color: ColorType; hex: string}) {
  const [format, setFormat] = React.useState<ColorFormat>(getPersistedFormat)
  const [copied, setCopied] = React.useState(false)
  const copiedTimeout = React.useRef<ReturnType<typeof setTimeout>>()

  React.useEffect(() => () => clearTimeout(copiedTimeout.current), [])

  const code = formatColor(format, color, hex)
  const currentLabel = COLOR_FORMATS.find(f => f.key === format)?.label ?? 'HEX'

  function changeFormat(next: ColorFormat) {
    setFormat(next)
    try {
      localStorage.setItem(COLOR_FORMAT_KEY, next)
    } catch {
      // Ignore write failures; the in-memory value still updates.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      clearTimeout(copiedTimeout.current)
      copiedTimeout.current = setTimeout(() => setCopied(false), 1200)
    } catch {
      // Ignore copy failures (e.g. clipboard blocked).
    }
  }

  return (
    <Box
      sx={{
        background: 'color-mix(in srgb, var(--color-background-secondary) 84%, #e4d5b7 16%)',
        borderRadius: 8,
        padding: '4px 4px 12px'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 28
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            height: 28,
            padding: '0 8px',
            borderRadius: 6,
            color: 'var(--color-text)',
            opacity: 0.7,
            cursor: 'pointer',
            '&:hover': {opacity: 1},
            '&:focus-within': {outline: '2px solid var(--color-accent-emphasis, #0969da)', outlineOffset: -2}
          }}
        >
          <Box
            as="span"
            sx={{
              fontSize: 0,
              fontWeight: 600,
              letterSpacing: '0.04em',
              fontFamily: 'mono',
              textTransform: 'uppercase'
            }}
          >
            {currentLabel}
          </Box>
          <ChevronDown size={14} style={{opacity: 0.6}} />
          <Box
            as="select"
            aria-label="Color format"
            value={format}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => changeFormat(event.target.value as ColorFormat)}
            sx={{
              all: 'unset',
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer'
            }}
          >
            {COLOR_FORMATS.map(({key, label}) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Box>
        </Box>
        <IconButton
          $transparent
          aria-label={copied ? 'Copied' : 'Copy'}
          icon={icon16(copied ? Check : Copy)}
          onClick={copy}
        />
      </Box>
      <Box
        as="code"
        sx={{
          display: 'block',
          fontFamily: 'mono',
          fontSize: 2,
          padding: '0 10px',
          color: 'color-mix(in srgb, var(--color-text) 62%, #8a5a2b 38%)',
          wordBreak: 'break-all'
        }}
      >
        {code}
      </Box>
    </Box>
  )
}

export function Color({paletteId = '', scaleId = '', index = ''}: {paletteId: string; scaleId: string; index: string}) {
  const [state, send] = useGlobalState()
  const palette = state.context.palettes[paletteId]
  const scale = palette.scales[scaleId]
  const indexAsNumber = parseInt(index, 10)
  const color = scale.colors[indexAsNumber]

  if (!color) {
    return null
  }

  const hex = colorToHex(color)

  return (
    <SidebarPanel
      title={`${scale.name}.${getColorName(scale.colors, indexAsNumber)}`}
      action={
        <IconButton
          $transparent
          aria-label="Delete color"
          icon={icon16(Trash2)}
          disabled={scale.colors.length === 1}
          onClick={() =>
            send({
              type: 'DELETE_COLOR',
              paletteId,
              scaleId,
              index: parseInt(index)
            })
          }
        />
      }
    >
      <VStack spacing={16}>
        <Box sx={{width: '100%', height: 48, background: hex, borderRadius: 1}} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8
          }}
        >
          <VStack spacing={4}>
            <label htmlFor="hue" style={{fontSize: 14}}>
              H
            </label>
            <Input
              id="hue"
              type="number"
              style={{width: '100%'}}
              value={color.hue}
              min={0}
              max={360}
              onChange={event => {
                send({
                  type: 'CHANGE_COLOR_VALUE',
                  paletteId,
                  scaleId,
                  index: indexAsNumber,
                  value: {
                    hue: event.target.valueAsNumber || 0
                  }
                })
              }}
            />
          </VStack>
          <VStack spacing={4}>
            <label htmlFor="saturation" style={{fontSize: 14}}>
              S
            </label>
            <Input
              id="saturation"
              type="number"
              style={{width: '100%'}}
              value={color.saturation}
              min={0}
              max={100}
              onChange={event => {
                send({
                  type: 'CHANGE_COLOR_VALUE',
                  paletteId,
                  scaleId,
                  index: indexAsNumber,
                  value: {
                    saturation: event.target.valueAsNumber || 0
                  }
                })
              }}
            />
          </VStack>
          <VStack spacing={4}>
            <label htmlFor="lightness" style={{fontSize: 14}}>
              L
            </label>
            <Input
              id="lightness"
              type="number"
              style={{width: '100%'}}
              value={color.lightness}
              min={0}
              max={100}
              onChange={event => {
                send({
                  type: 'CHANGE_COLOR_VALUE',
                  paletteId,
                  scaleId,
                  index: indexAsNumber,
                  value: {
                    lightness: event.target.valueAsNumber || 0
                  }
                })
              }}
            />
          </VStack>
        </div>

        <ColorCodeSnippet color={color} hex={hex} />
      </VStack>
    </SidebarPanel>
  )
}
