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
      if (contrast >= 4.5) return scaleHexes[i]
      if (contrast > fallbackContrast) {
        fallback = scaleHexes[i]
        fallbackContrast = contrast
      }
    }
  }

  return fallback
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
