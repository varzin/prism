import paletteTemplates from './palette-templates.json'

// A template is a set of scales expressed the same way example-scales.json is:
// a scale name mapped to hex strings ordered light -> dark (or a single hex for
// a one-swatch scale). Creating a palette from a template converts these to the
// app's HSLuv color model, exactly as the built-in example scales are.
export type TemplateScales = Record<string, string[] | string>

export type PaletteTemplate = {
  id: string
  label: string
  scales: TemplateScales
}

// The default option: a palette with no scales, ready to build up by hand.
export const SCRATCH_TEMPLATE_ID = 'scratch'

// Order here is the order shown in the select. "Start from scratch" leads
// because an empty palette is the neutral default; the named palettes follow.
const templateLabels: {id: string; label: string}[] = [
  {id: SCRATCH_TEMPLATE_ID, label: 'Start from scratch'},
  {id: 'tailwind', label: 'Tailwind CSS'},
  {id: 'apple', label: 'Apple'},
  {id: 'material', label: 'Material Design'},
  {id: 'radix', label: 'Radix Colors'},
  {id: 'opencolor', label: 'Open Color'},
  {id: 'ant', label: 'Ant Design'},
  {id: 'carbon', label: 'IBM Carbon'}
]

const scalesById = paletteTemplates as Record<string, TemplateScales>

export const templates: PaletteTemplate[] = templateLabels.map(({id, label}) => ({
  id,
  label,
  scales: id === SCRATCH_TEMPLATE_ID ? {} : scalesById[id] ?? {}
}))

export function getTemplateScales(id: string): TemplateScales {
  return templates.find(template => template.id === id)?.scales ?? {}
}
