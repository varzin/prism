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
