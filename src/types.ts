export type Color = {
  hue: number // 0-360
  saturation: number // 0-100
  lightness: number // 0-100
  name?: string // display name for this step (e.g. "10", "20"); falls back to a step-of-10 default
  locked?: boolean // when true, this color's points on the H/S/L curves can be selected but not moved
}

// The three channels a color is edited through, each with its own curve editor.
export type Channel = 'hue' | 'saturation' | 'lightness'

export const channels: Channel[] = ['hue', 'saturation', 'lightness']

// One of the named bezier presets (see easings.ts).
export type EasingKey =
  | 'linear'
  | 'quadraticIn'
  | 'quadraticOut'
  | 'quadraticInOut'
  | 'cubicIn'
  | 'cubicOut'
  | 'cubicInOut'
  | 'quarticIn'
  | 'quarticOut'
  | 'quarticInOut'
  | 'quinticIn'
  | 'quinticOut'
  | 'quinticInOut'
  | 'sineIn'
  | 'sineOut'
  | 'sineInOut'
  | 'circularIn'
  | 'circularOut'
  | 'circularInOut'
  | 'exponentialIn'
  | 'exponentialOut'
  | 'exponentialInOut'

// The two control points of a cubic bezier, as [x1, y1, x2, y2]. The curve runs
// from (0,0) to (1,1); x is pinned to 0..1 because a ramp cannot doubt back on
// itself, and y likewise, which keeps every computed color between the two ends.
export type BezierPoints = [number, number, number, number]

// What drives one channel: a preset by name, or hand-placed control points.
export type Curve = EasingKey | {custom: BezierPoints}

export type Scale = {
  id: string
  name: string
  colors: Color[]
  // Channels driven by a bezier curve. A driven channel keeps its first and
  // last color as handles and derives everything in between from them, so the
  // colors stay the source of truth -- this only records how they got there.
  // Per scale by design: picking a curve is not linking to a shared object.
  curves?: Partial<Record<Channel, Curve>>
}

// Which import/export format a palette uses: one of the pre-baked presets, or
// `custom` — the user's own template, edited by hand.
export type FormatPresetKey = 'custom' | 'nectary' | 'w3c'

export type PaletteFormat = {
  preset: FormatPresetKey
  // The Custom draft, kept alongside the preset so switching to a preset and
  // back to Custom restores exactly what the user last typed. Also the template
  // actually used whenever `preset === 'custom'`.
  custom: string
}

export type Palette = {
  id: string
  name: string
  backgroundColor: string
  scales: Record<string, Scale>
  // The import/export format for this palette. Absent on palettes created before
  // formats became per-palette; treated as a Custom default (see resolveTemplate).
  format?: PaletteFormat
}
