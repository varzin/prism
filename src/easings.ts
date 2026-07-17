import bezier, {EasingFunction} from 'bezier-easing'
import {BezierPoints, Curve, EasingKey} from './types'
import {clamp} from './utils'

// The presets, as control points rather than as built functions. Points are what
// the custom editor hands back and what it needs to start from, so keeping them
// as the source and deriving the functions means picking Custom right after a
// preset opens the editor on that preset's own shape instead of a reset.
export const easingPoints: Record<EasingKey, BezierPoints> = {
  linear: [0.5, 0.5, 0.5, 0.5],

  quadraticIn: [0.55, 0.085, 0.68, 0.53],
  quadraticOut: [0.25, 0.46, 0.45, 0.94],
  quadraticInOut: [0.455, 0.03, 0.515, 0.955],

  cubicIn: [0.55, 0.055, 0.675, 0.19],
  cubicOut: [0.215, 0.61, 0.355, 1],
  cubicInOut: [0.645, 0.045, 0.355, 1],

  quarticIn: [0.895, 0.03, 0.685, 0.22],
  quarticOut: [0.165, 0.84, 0.44, 1],
  quarticInOut: [0.77, 0, 0.175, 1],

  quinticIn: [0.755, 0.05, 0.855, 0.06],
  quinticOut: [0.23, 1, 0.32, 1],
  quinticInOut: [0.86, 0, 0.07, 1],

  sineIn: [0.47, 0, 0.745, 0.715],
  sineOut: [0.39, 0.575, 0.565, 1],
  sineInOut: [0.445, 0.05, 0.55, 0.95],

  circularIn: [0.6, 0.04, 0.98, 0.335],
  circularOut: [0.075, 0.82, 0.165, 1],
  circularInOut: [0.785, 0.135, 0.15, 0.86],

  exponentialIn: [0.95, 0.05, 0.795, 0.035],
  exponentialOut: [0.19, 1, 0.22, 1],
  exponentialInOut: [1, 0, 0, 1]
}

// Select order: linear first, then each family in/out/in-out. `Object.keys` on
// easingPoints would do, but only by accident of declaration order, and the
// labels have to be written out somewhere regardless.
export const easingOptions: {key: EasingKey; label: string}[] = [
  {key: 'linear', label: 'Linear'},
  {key: 'quadraticIn', label: 'Quadratic in'},
  {key: 'quadraticOut', label: 'Quadratic out'},
  {key: 'quadraticInOut', label: 'Quadratic in-out'},
  {key: 'cubicIn', label: 'Cubic in'},
  {key: 'cubicOut', label: 'Cubic out'},
  {key: 'cubicInOut', label: 'Cubic in-out'},
  {key: 'quarticIn', label: 'Quartic in'},
  {key: 'quarticOut', label: 'Quartic out'},
  {key: 'quarticInOut', label: 'Quartic in-out'},
  {key: 'quinticIn', label: 'Quintic in'},
  {key: 'quinticOut', label: 'Quintic out'},
  {key: 'quinticInOut', label: 'Quintic in-out'},
  {key: 'sineIn', label: 'Sine in'},
  {key: 'sineOut', label: 'Sine out'},
  {key: 'sineInOut', label: 'Sine in-out'},
  {key: 'circularIn', label: 'Circular in'},
  {key: 'circularOut', label: 'Circular out'},
  {key: 'circularInOut', label: 'Circular in-out'},
  {key: 'exponentialIn', label: 'Exponential in'},
  {key: 'exponentialOut', label: 'Exponential out'},
  {key: 'exponentialInOut', label: 'Exponential in-out'}
]

export function isEasingKey(value: string): value is EasingKey {
  return value in easingPoints
}

export function isCustomCurve(curve: Curve | undefined): curve is {custom: BezierPoints} {
  return typeof curve === 'object' && curve !== null
}

// Where Custom opens when nothing was driving the channel: a gentle S, not the
// straight line. A straight line is what None already gives you, so arriving on
// one would leave the editor looking like it had done nothing. This is a sine
// in-out rounded to the two decimals the editor works in.
export const defaultCustomPoints: BezierPoints = [0.45, 0.05, 0.55, 0.95]

// The editor drags and types in hundredths, so points entering it are rounded to
// match. Otherwise a preset's third decimal (cubicIn's 0.055, say) would sit in
// the state while the field showed 0.06, and the first keystroke would jump.
export function roundPoints(points: BezierPoints): BezierPoints {
  return points.map(value => Math.round(value * 100) / 100) as BezierPoints
}

// The control points behind whatever is driving a channel, which is what Custom
// picks up when it takes over.
export function curvePoints(curve: Curve): BezierPoints {
  return isCustomCurve(curve) ? curve.custom : easingPoints[curve]
}

// bezier-easing rejects an x outside 0..1 by throwing, and this runs on every
// render of a driven channel, so persisted points are clamped rather than
// trusted: a bad number should flatten a curve, not take down the page.
export function curveFunction(curve: Curve): EasingFunction {
  const [x1, y1, x2, y2] = curvePoints(curve)
  return bezier(clamp(x1, 0, 1), y1, clamp(x2, 0, 1), y2)
}

// Redistributes everything between the first and last value along `curve`, which
// is what makes the endpoints the only handles: they are returned untouched and
// everything else is a function of them. A scale of fewer than three colors has
// nothing in between, so it comes back unchanged.
//
// Rounded to a tenth to match the step the curve editor drags on -- without it
// the endpoints would round but the computed points would not, and the same
// curve would read as clean or noisy depending on which point you grabbed.
export function applyCurve(values: number[], curve: Curve): number[] {
  const last = values.length - 1
  if (last < 2) return values

  const easing = curveFunction(curve)
  const from = values[0]
  const to = values[last]

  return values.map((value, index) => {
    if (index === 0 || index === last) return value
    const t = easing(index / last)
    return Math.round((from + (to - from) * t) * 10) / 10
  })
}
