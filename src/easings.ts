import bezier, {EasingFunction} from 'bezier-easing'

export const easings = ['in', 'out', 'inOut'] as const
export type Easing = typeof easings[number]

// How much of a dragged point's movement a neighbor `distance` columns away
// inherits, under proportional editing with the given radius.
//
// The drag is meant to feel like pulling taut cloth, so the profile is a sheet
// under tension rather than an easing chosen for its silhouette. Tension has no
// way to resist a point load except by kinking, which is why the material peaks
// under the finger and drops away fast: at a radius of 3 the columns to each
// side take 0.56, 0.25 and 0.06 of the movement.
//
// Squaring is what makes it read as material instead of a fold. It brings the
// weight into 0 with zero slope at distance = radius + 1, so the span that moves
// meets the span that doesn't tangentially and the curve has no crease at the
// boundary. Arriving at any other angle creases it -- the cubic-in this replaced
// came in at a slope of 2.49 and read as a rigid plate snapping -- and no
// material creases somewhere nothing touched it. Anything replacing this curve
// has to land flat too, or the physicality goes with it.
//
// Sampling at distance / (radius + 1) rather than distance / radius is what
// leaves the far column any weight at all: at distance / radius it would land
// on 0 and a radius of 3 would move only two columns per side.
export function falloffWeight(distance: number, radius: number) {
  if (distance === 0) return 1
  if (radius < 1 || distance > radius) return 0
  const t = distance / (radius + 1)
  return (1 - t) ** 2
}

type EasingFunctionsDefinition = {
  [name: string]:
    | EasingFunction
    | {
        [easing in Easing]: EasingFunction
      }
}

export const easingFunctions: EasingFunctionsDefinition = {
  linear: bezier(0.5, 0.5, 0.5, 0.5),

  quadratic: {
    inOut: bezier(0.455, 0.03, 0.515, 0.955),
    in: bezier(0.55, 0.085, 0.68, 0.53),
    out: bezier(0.25, 0.46, 0.45, 0.94)
  },

  cubic: {
    inOut: bezier(0.645, 0.045, 0.355, 1),
    in: bezier(0.55, 0.055, 0.675, 0.19),
    out: bezier(0.215, 0.61, 0.355, 1)
  },

  quartic: {
    inOut: bezier(0.77, 0, 0.175, 1),
    in: bezier(0.895, 0.03, 0.685, 0.22),
    out: bezier(0.165, 0.84, 0.44, 1)
  },

  quintic: {
    inOut: bezier(0.86, 0, 0.07, 1),
    in: bezier(0.755, 0.05, 0.855, 0.06),
    out: bezier(0.23, 1, 0.32, 1)
  },

  sine: {
    inOut: bezier(0.445, 0.05, 0.55, 0.95),
    in: bezier(0.47, 0, 0.745, 0.715),
    out: bezier(0.39, 0.575, 0.565, 1)
  },

  circular: {
    inOut: bezier(0.785, 0.135, 0.15, 0.86),
    in: bezier(0.6, 0.04, 0.98, 0.335),
    out: bezier(0.075, 0.82, 0.165, 1)
  },

  exponential: {
    inOut: bezier(1, 0, 0, 1),
    in: bezier(0.95, 0.05, 0.795, 0.035),
    out: bezier(0.19, 1, 0.22, 1)
  }
}
