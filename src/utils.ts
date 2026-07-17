import {Channel, Color} from './types'
import hsluv from 'hsluv'
import {getContrast, toHex} from 'color2k'

export function hexToColor(hex: string): Color {
  const [hue, saturation, lightness] = hsluv.hexToHsluv(toHex(hex)).map(value => Math.round(value * 100) / 100)
  return {hue, saturation, lightness}
}

export function colorToHex(color: Color): string {
  return hsluv.hsluvToHex([color.hue, color.saturation, color.lightness])
}

export function randomIntegerInRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getRange(type: Channel) {
  const ranges = {
    hue: {min: 0, max: 360},
    saturation: {min: 0, max: 100},
    lightness: {min: 0, max: 100}
  }
  return ranges[type]
}

export function getContrastScore(contrast: number) {
  return contrast < 3 ? 'Fail' : contrast < 4.5 ? 'AA+' : contrast < 7 ? 'AA' : 'AAA'
}

// What ink has to clear against the surface behind it: WCAG AA for normal text.
const AA_CONTRAST = 4.5

// The color in `scaleHexes` nearest (by position) to `index` that clears AA
// contrast against `against` — searching outward from `index` and returning the
// first side to pass. Falls back to the highest-contrast color when none does.
export function getNearestContrasting(scaleHexes: string[], index: number, against: string) {
  let fallback = scaleHexes[index]
  let fallbackContrast = 0

  for (let distance = 0; distance < scaleHexes.length; distance++) {
    for (const i of distance === 0 ? [index] : [index - distance, index + distance]) {
      if (i < 0 || i >= scaleHexes.length) continue
      const contrast = getContrast(against, scaleHexes[i])
      if (contrast >= AA_CONTRAST) return scaleHexes[i]
      if (contrast > fallbackContrast) {
        fallback = scaleHexes[i]
        fallbackContrast = contrast
      }
    }
  }

  return fallback
}

// Hues are angles, so they average as unit vectors: a plain mean would put the
// average of 350 and 10 at 180, opposite where it belongs. Weighted by
// saturation, because the hue of a near-gray color is arbitrary and shouldn't
// drag the result away from the colors that actually carry the scale's tint.
function getAverageHue(colors: Color[]): number {
  let x = 0
  let y = 0

  for (const {hue, saturation} of colors) {
    const radians = (hue * Math.PI) / 180
    x += Math.cos(radians) * saturation
    y += Math.sin(radians) * saturation
  }

  // Every color in the scale is gray: there's no hue to recover, and any answer
  // is as good as another.
  if (x === 0 && y === 0) return colors[0]?.hue ?? 0
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// How far each step moves along the lightness axis when synthesizing an ink.
// Fine enough that the result isn't visibly overshot, coarse enough to settle in
// a couple dozen steps.
const LIGHTNESS_STEP = 4

// An ink for swatches the scale can't light itself: every color near-white, say,
// or a mid-tone the scale never strays far enough from. Holds the scale's average
// hue and saturation and moves only along lightness.
//
// Both sides are tried at each distance rather than committing to one: which side
// can reach AA isn't knowable up front, and guessing risks returning an ink from
// an exhausted side while the other one would have cleared. Nearer distances win,
// so the ink that reads is also the one that strays least from the scale — though
// a mid-tone swatch admits no AA ink except near-white or near-black, and there
// the hue is gone whatever we do.
function getSynthesizedInk(colors: Color[], against: string): string {
  const hue = getAverageHue(colors)
  const saturation = colors.reduce((sum, color) => sum + color.saturation, 0) / colors.length
  const {lightness} = hexToColor(against)
  let fallback = colorToHex({hue, saturation, lightness: lightness > 50 ? 0 : 100})
  let fallbackContrast = 0

  for (let offset = LIGHTNESS_STEP; offset <= 100; offset += LIGHTNESS_STEP) {
    // Clamped, not skipped, so pure black and white are always reachable however
    // the steps happen to land relative to the swatch.
    const candidates = [Math.max(0, lightness - offset), Math.min(100, lightness + offset)]
      .map(value => colorToHex({hue, saturation, lightness: value}))
      .map(hex => ({hex, contrast: getContrast(against, hex)}))
      .sort((a, b) => b.contrast - a.contrast)

    for (const {hex, contrast} of candidates) {
      // Sorted, so of two inks equally far from the scale this is the readable one.
      if (contrast >= AA_CONTRAST) return hex
      if (contrast > fallbackContrast) {
        fallback = hex
        fallbackContrast = contrast
      }
    }
  }

  // Nothing on either side cleared AA. Can't happen for any real color — black or
  // white clears everything short of a mid-gray — so this is just the honest
  // best-effort rather than a case worth designing for.
  return fallback
}

// The ink for the label sitting on swatch `index`. Prefers a color the scale
// actually contains — the nearest one that clears AA against the swatch — so the
// label reads while staying in the palette's own hue family, and falls back to a
// synthesized ink only when the scale can't light itself.
//
// This depends on the swatch and its scale, never on what's selected: the labels
// have to hold still while you click through the scale. The mark's disc is what
// tracks the selection.
export function getLabelInk(colors: Color[], scaleHexes: string[], index: number): string {
  const against = scaleHexes[index]
  const fromScale = getNearestContrasting(scaleHexes, index, against)
  return getContrast(against, fromScale) >= AA_CONTRAST ? fromScale : getSynthesizedInk(colors, against)
}

// Default step between color names when none is stored: 10, 20, 30, …
const DEFAULT_NAME_STEP = 10

// The name shown for a color. Explicit names win; otherwise fall back to the
// position-based default so legacy scales (and freshly imported ones) still
// read as 10, 20, 30, …
export function getColorName(colors: Color[], index: number): string {
  return colors[index]?.name ?? String((index + 1) * DEFAULT_NAME_STEP)
}

// Parse a name as a number, or null when it isn't numeric (e.g. "primary").
function parseName(name: string | undefined): number | null {
  if (name === undefined || name.trim() === '') return null
  const value = Number(name)
  return Number.isFinite(value) ? value : null
}

// Predict the name for a color inserted at `at` (0..names.length) given the
// current effective names. Continues the numeric progression; when it can't
// (non-numeric neighbours, or a predicted 0 at the start) it falls back per the
// rules below. `at >= length` means append, `at === 0` prepend, else in-between.
export function predictColorName(names: string[], at: number): string {
  const n = names.length
  // Fallback to the index (position) when no numeric prediction is possible.
  const fallback = String(at)

  // Append to the end: continue the trend of the last two names.
  if (at >= n) {
    if (n === 0) return String(DEFAULT_NAME_STEP)
    const last = parseName(names[n - 1])
    if (last === null) return fallback
    // Only one numeric neighbour — no trend yet, assume the default step.
    const step =
      n >= 2 && parseName(names[n - 2]) !== null ? last - (parseName(names[n - 2]) as number) : DEFAULT_NAME_STEP
    return String(Math.round(last + step))
  }

  // Prepend to the start: step back from the first name.
  if (at <= 0) {
    const first = parseName(names[0])
    if (first === null) return fallback
    const step = n >= 2 && parseName(names[1]) !== null ? (parseName(names[1]) as number) - first : DEFAULT_NAME_STEP
    const predicted = Math.round(first - step)
    // Avoid predicting 0: use half of the closest (first) name instead.
    if (predicted === 0) {
      const halved = Math.round(first / 2)
      return halved === 0 ? fallback : String(halved)
    }
    return String(predicted)
  }

  // Insert in between: the midpoint of the two neighbours.
  const before = parseName(names[at - 1])
  const after = parseName(names[at])
  if (before === null || after === null) return fallback
  return String(Math.round((before + after) / 2))
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
