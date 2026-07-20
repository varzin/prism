import {parseToRgba} from 'color2k'
import {v4 as uniqueId} from 'uuid'
import {Color, FormatPresetKey, Palette, PaletteFormat, Scale} from './types'
import {clamp, colorToHex, getColorName, hexToColor} from './utils'

// Legacy localStorage key: formats used to be a single global template here,
// before they moved into each palette. Kept only so loadPersistedState can
// migrate an existing value into palettes on first run.
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

// Pre-baked format presets. Edit the templates here to tweak what each preset
// inserts — they all follow the same placeholder rules as a Custom template
// (see compileTemplate). `custom` has no template: it uses the user's own draft.
// A preset is either template-based (a string with placeholders) or code-backed
// (`code: true` — serialized by dedicated functions rather than a template,
// because its shape can't be produced by string substitution).
export const FORMAT_PRESETS: {key: FormatPresetKey; label: string; template?: string; code?: boolean}[] = [
  {key: 'custom', label: 'Custom'},
  {
    key: 'nectary',
    // Nectary / Brand Library design-token shape: a bare list of scales.
    label: 'Nectary',
    template: `"${PLACEHOLDER_SCALE_NAME}": {
  "${PLACEHOLDER_SCALE_STEP}": {
    "value": "${PLACEHOLDER_SCALE_COLOR_VALUE}",
    "type": "color",
    "description": "Based on the Brand Library"
  }
}`
  },
  {
    key: 'w3c',
    // W3C Design Tokens (DTCG) — the shape Figma's Variables import/export reads
    // and writes. Code-backed: each color becomes a { colorSpace, components,
    // alpha, hex } object, so the RGB components are computed per color. Nested
    // groups map to "/"-separated scale names, and Figma's own ids
    // ($extensions) are dropped so the file stays portable.
    label: 'W3C DTCG',
    code: true
  }
]

// Whether a preset is serialized by dedicated code rather than a template.
export function isCodeBackedPreset(preset: FormatPresetKey): boolean {
  return FORMAT_PRESETS.find(preset_ => preset_.key === preset)?.code === true
}

// Look up a preset's template. Returns undefined for `custom` (or unknown keys).
export function presetTemplate(key: FormatPresetKey): string | undefined {
  return FORMAT_PRESETS.find(preset => preset.key === key)?.template
}

// The format a palette falls back to when it has none saved yet.
export const DEFAULT_PALETTE_FORMAT: PaletteFormat = {preset: 'custom', custom: DEFAULT_TEMPLATE}

// The template a palette actually imports/exports with: the preset's baked shape,
// or the user's Custom draft. Tolerates a missing format (older palettes).
export function resolveTemplate(format: PaletteFormat | undefined): string {
  if (!format || format.preset === 'custom') {
    return format?.custom || DEFAULT_TEMPLATE
  }
  return presetTemplate(format.preset) || format.custom || DEFAULT_TEMPLATE
}

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
    scale.colors.forEach((color, index) => {
      const stepName = getColorName(scale.colors, index)
      const hex = colorToHex(color)
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

    scales.push({id: uniqueId(), name: scaleName, colors})
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
  scales: {
    neutral: {
      id: 'neutral',
      name: 'neutral',
      colors: [
        {...hexToColor('#F7F9FA'), name: '50'},
        {...hexToColor('#EBEEF0'), name: '100'}
      ]
    },
    raspberry: {
      id: 'raspberry',
      name: 'raspberry',
      colors: [{...hexToColor('#FFF6F5'), name: '50'}]
    }
  }
}

// Render the export the current template would produce, against a fixed sample.
export function previewTemplate(template: string): string {
  return serialize(SAMPLE_PALETTE, template)
}

// ---------------------------------------------------------------------------
// W3C DTCG (Figma Variables) — a code-backed format. Colors become DTCG color
// objects, and nested groups map to "/"-separated scale names. This can't be a
// string template because each color's sRGB components are computed per color.
// ---------------------------------------------------------------------------

// Build a DTCG color value: sRGB components (0..1) plus a hex convenience field,
// the shape Figma's Variables import reads.
function colorToDtcgValue(hex: string): Json {
  const [red, green, blue, alpha] = parseToRgba(hex)
  return {
    colorSpace: 'srgb',
    components: [red / 255, green / 255, blue / 255],
    alpha,
    hex: hex.toUpperCase()
  }
}

// Turn sRGB components (0..1) back into a hex string, for reading DTCG values
// that omit the convenience `hex` field.
function componentsToHex(red: number, green: number, blue: number): string {
  const channel = (value: number) =>
    Math.round(clamp(value, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(red)}${channel(green)}${channel(blue)}`
}

// Read a color out of a DTCG leaf, tolerating both the rich object value and a
// bare hex string. Returns null for non-color or unreadable tokens.
function dtcgLeafToColor(leaf: {[key: string]: Json}): Color | null {
  const type = leaf['$type']
  if (typeof type === 'string' && type !== 'color') return null

  const value = leaf['$value']
  let hex: string | null = null
  if (typeof value === 'string') {
    hex = value
  } else if (isPlainObject(value)) {
    if (typeof value.hex === 'string') {
      hex = value.hex
    } else if (Array.isArray(value.components) && value.components.length >= 3) {
      const [red, green, blue] = value.components
      if (typeof red === 'number' && typeof green === 'number' && typeof blue === 'number') {
        hex = componentsToHex(red, green, blue)
      }
    }
  }
  if (!hex) return null

  try {
    return hexToColor(hex)
  } catch {
    return null
  }
}

// Serialize a palette to the DTCG shape Figma reads. A scale name is split on
// "/" into nested groups, so "Background/Default" becomes Background → Default →
// steps; shared prefixes across scales merge into one group tree.
export function dtcgSerialize(palette: Palette): string {
  const root: {[key: string]: Json} = {}

  for (const scale of Object.values(palette.scales)) {
    const groups = scale.name
      .split('/')
      .map(segment => segment.trim())
      .filter(Boolean)

    scale.colors.forEach((color, index) => {
      const path = [...groups, getColorName(scale.colors, index)]
      let node = root
      for (let depth = 0; depth < path.length - 1; depth++) {
        const key = path[depth]
        if (!isPlainObject(node[key])) node[key] = {}
        node = node[key] as {[key: string]: Json}
      }
      node[path[path.length - 1]] = {
        $type: 'color',
        $value: colorToDtcgValue(colorToHex(color))
      }
    })
  }

  return JSON.stringify(root, null, 2)
}

// Parse a DTCG token file into scales. Walks nested groups to every color leaf;
// the leaf's path becomes scaleName ("/"-joined groups) + step (last segment).
// Figma's own ids and other metadata ($-prefixed keys) are ignored.
export function dtcgDeserialize(jsonText: string): Scale[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error("The file isn't valid JSON.")
  }
  if (!isPlainObject(parsed)) {
    throw new Error('Expected a DTCG token object at the top level.')
  }

  const order: string[] = []
  const byScale = new Map<string, Color[]>()

  function visit(node: {[key: string]: Json}, path: string[]) {
    if ('$value' in node) {
      const color = dtcgLeafToColor(node)
      if (!color) return
      const stepName = path[path.length - 1] ?? 'value'
      const scaleName = path.length > 1 ? path.slice(0, -1).join('/') : stepName
      if (!byScale.has(scaleName)) {
        byScale.set(scaleName, [])
        order.push(scaleName)
      }
      byScale.get(scaleName)!.push({...color, name: stepName})
      return
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue
      if (isPlainObject(child)) visit(child, [...path, key])
    }
  }
  visit(parsed, [])

  const scales = order.map(name => ({id: uniqueId(), name, colors: byScale.get(name)!}))
  if (scales.length === 0) {
    throw new Error('No color tokens found.')
  }
  return scales
}

// ---------------------------------------------------------------------------
// Dispatch: pick the template engine or a code-backed preset from the format.
// ---------------------------------------------------------------------------

export function serializePalette(palette: Palette, format: PaletteFormat | undefined): string {
  if (format && isCodeBackedPreset(format.preset)) return dtcgSerialize(palette)
  return serialize(palette, resolveTemplate(format))
}

export function deserializePalette(text: string, format: PaletteFormat | undefined): Scale[] {
  if (format && isCodeBackedPreset(format.preset)) return dtcgDeserialize(text)
  return deserialize(text, resolveTemplate(format))
}

// A live sample of what a format produces, for the settings preview and the
// import placeholder.
export function previewFormat(format: PaletteFormat | undefined): string {
  if (format && isCodeBackedPreset(format.preset)) return dtcgSerialize(SAMPLE_PALETTE)
  return serialize(SAMPLE_PALETTE, resolveTemplate(format))
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
