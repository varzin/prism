import {v4 as uniqueId} from 'uuid'
import {Color, Palette, Scale} from './types'
import {colorToHex, getColor, getColorName, hexToColor} from './utils'

// localStorage key for the user's custom import/export format template.
export const FORMAT_TEMPLATE_KEY = 'export_format_template'

// The three placeholders a template may use, each exactly once.
export const PLACEHOLDER_SCALE_NAME = '{{scaleName}}'
export const PLACEHOLDER_SCALE_STEP = '{{scaleStep}}'
export const PLACEHOLDER_SCALE_COLOR_VALUE = '{{scaleColorValue}}'

export const PLACEHOLDERS = [
  {token: PLACEHOLDER_SCALE_NAME, description: "each scale's name"},
  {token: PLACEHOLDER_SCALE_STEP, description: "each step's key (e.g. 50, 100)"},
  {token: PLACEHOLDER_SCALE_COLOR_VALUE, description: "the color's hex value"}
]

// Default template — the nested design-token shape from the Brand Library.
export const DEFAULT_TEMPLATE = `"${PLACEHOLDER_SCALE_NAME}": {
  "${PLACEHOLDER_SCALE_STEP}": {
    "value": "${PLACEHOLDER_SCALE_COLOR_VALUE}",
    "type": "color",
    "description": "Based on the Brand Library"
  }
}`

// Sentinels use private-use codepoints so they never collide with real content
// yet stay valid inside a JSON string.
const SENTINEL_NAME = 'scaleName'
const SENTINEL_STEP = 'scaleStep'
const SENTINEL_VALUE = 'scaleColorValue'

type Json = string | number | boolean | null | Json[] | {[key: string]: Json}

// A compiled template: the constant leaf shape (with a marked slot for the color
// value) plus the path from the step object to that slot.
export type CompiledTemplate = {
  leafTemplate: Json
  valuePath: string[]
}

function occurrences(text: string, token: string): number {
  return text.split(token).length - 1
}

// Find the path (array of keys) from `node` to the string equal to SENTINEL_VALUE.
// Returns null when the sentinel value isn't present.
function findValuePath(node: Json): string[] | null {
  if (node === SENTINEL_VALUE) return []
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return null
  for (const [key, child] of Object.entries(node)) {
    const sub = findValuePath(child)
    if (sub) return [key, ...sub]
    if (child === SENTINEL_VALUE) return [key]
  }
  return null
}

/**
 * Compile a template string into a descriptor usable for export/import.
 * Throws an Error with a specific, user-facing message when the template is
 * malformed.
 */
export function compileTemplate(template: string): CompiledTemplate {
  for (const {token} of PLACEHOLDERS) {
    const count = occurrences(template, token)
    if (count === 0) {
      throw new Error(`Add ${token} — the format needs it exactly once.`)
    }
    if (count > 1) {
      throw new Error(`${token} is used ${count} times. Use it exactly once.`)
    }
  }

  const tokenized = template
    .split(PLACEHOLDER_SCALE_NAME)
    .join(SENTINEL_NAME)
    .split(PLACEHOLDER_SCALE_STEP)
    .join(SENTINEL_STEP)
    .split(PLACEHOLDER_SCALE_COLOR_VALUE)
    .join(SENTINEL_VALUE)

  let parsed: Json
  try {
    parsed = JSON.parse(`{${tokenized}}`)
  } catch {
    throw new Error("The format isn't valid JSON. Check for missing commas, quotes, or braces.")
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${PLACEHOLDER_SCALE_NAME} must be a top-level key.`)
  }

  const topKeys = Object.keys(parsed)
  if (topKeys.length !== 1 || topKeys[0] !== SENTINEL_NAME) {
    throw new Error(`${PLACEHOLDER_SCALE_NAME} must be the only top-level key.`)
  }

  const scaleValue = parsed[SENTINEL_NAME]
  if (scaleValue === null || typeof scaleValue !== 'object' || Array.isArray(scaleValue)) {
    throw new Error(`${PLACEHOLDER_SCALE_STEP} must be a key inside the scale object.`)
  }

  const stepKeys = Object.keys(scaleValue)
  if (stepKeys.length !== 1 || stepKeys[0] !== SENTINEL_STEP) {
    throw new Error(`${PLACEHOLDER_SCALE_STEP} must be the only key inside the scale object.`)
  }

  const leafTemplate = scaleValue[SENTINEL_STEP]
  const valuePath = findValuePath(leafTemplate)
  if (!valuePath) {
    throw new Error(`Add ${PLACEHOLDER_SCALE_COLOR_VALUE} — it marks where each color's hex goes.`)
  }

  return {leafTemplate, valuePath}
}

function cloneJson<T extends Json>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

// Build a single step's value by cloning the leaf template and dropping the hex
// into the marked slot.
function buildLeaf(compiled: CompiledTemplate, hex: string): Json {
  if (compiled.valuePath.length === 0) return hex

  const leaf = cloneJson(compiled.leafTemplate)
  let node = leaf as {[key: string]: Json}
  for (let i = 0; i < compiled.valuePath.length - 1; i++) {
    node = node[compiled.valuePath[i]] as {[key: string]: Json}
  }
  node[compiled.valuePath[compiled.valuePath.length - 1]] = hex
  return leaf
}

/**
 * Serialize a palette to a JSON string following `template`.
 * Scale names are emitted verbatim (JSON handles escaping).
 */
export function serialize(palette: Palette, template: string): string {
  const compiled = compileTemplate(template)

  const output: {[scaleName: string]: {[step: string]: Json}} = {}

  for (const scale of Object.values(palette.scales)) {
    const steps: {[step: string]: Json} = {}
    scale.colors.forEach((_, index) => {
      const stepName = getColorName(scale.colors, index)
      const hex = colorToHex(getColor(palette.curves, scale, index))
      steps[stepName] = buildLeaf(compiled, hex)
    })
    output[scale.name] = steps
  }

  return JSON.stringify(output, null, 2)
}

function isPlainObject(value: unknown): value is {[key: string]: Json} {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Parse JSON text into scales following `template`. Extra leaf fields are
 * ignored. Throws an Error with a location-specific message on mismatch.
 */
export function deserialize(jsonText: string, template: string): Scale[] {
  const compiled = compileTemplate(template)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    // Tolerate a brace-less fragment (the shape shown in the template): a bare
    // list of "scale": {…} entries. Wrap it in an object and retry.
    try {
      parsed = JSON.parse(`{${jsonText}}`)
    } catch {
      throw new Error("The file isn't valid JSON. Wrap the scales in an object: { … }.")
    }
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Expected an object of scales at the top level.')
  }

  const scales: Scale[] = []

  for (const [scaleName, scaleValue] of Object.entries(parsed)) {
    if (!isPlainObject(scaleValue)) {
      throw new Error(`Scale "${scaleName}": expected an object of steps.`)
    }

    const colors: Color[] = []

    for (const [stepName, stepValue] of Object.entries(scaleValue)) {
      let node: Json = stepValue
      for (const key of compiled.valuePath) {
        if (!isPlainObject(node) || !(key in node)) {
          const location = compiled.valuePath.join('.') || 'the step value'
          throw new Error(`Scale "${scaleName}", step "${stepName}": expected a value at "${location}".`)
        }
        node = node[key]
      }

      if (typeof node !== 'string') {
        const field = compiled.valuePath[compiled.valuePath.length - 1] ?? 'value'
        throw new Error(`Scale "${scaleName}", step "${stepName}": "${field}" must be a string.`)
      }

      let color: Color
      try {
        color = hexToColor(node)
      } catch {
        throw new Error(`Scale "${scaleName}", step "${stepName}": "${node}" is not a valid color.`)
      }

      colors.push({...color, name: String(stepName)})
    }

    if (colors.length === 0) {
      throw new Error(`Scale "${scaleName}": needs at least one step.`)
    }

    scales.push({id: uniqueId(), name: scaleName, colors, curves: {}})
  }

  if (scales.length === 0) {
    throw new Error('No scales found.')
  }

  return scales
}

// A tiny sample used to render a live preview of the current template.
const SAMPLE_PALETTE: Palette = {
  id: 'preview',
  name: 'sample',
  backgroundColor: '#ffffff',
  curves: {},
  scales: {
    neutral: {
      id: 'neutral',
      name: 'neutral',
      curves: {},
      colors: [
        {...hexToColor('#F7F9FA'), name: '50'},
        {...hexToColor('#EBEEF0'), name: '100'}
      ]
    },
    raspberry: {
      id: 'raspberry',
      name: 'raspberry',
      curves: {},
      colors: [{...hexToColor('#FFF6F5'), name: '50'}]
    }
  }
}

// Render the export the current template would produce, against a fixed sample.
export function previewTemplate(template: string): string {
  return serialize(SAMPLE_PALETTE, template)
}

// Turn a palette name into a safe `.json` filename.
export function slugifyFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'palette'}.json`
}
