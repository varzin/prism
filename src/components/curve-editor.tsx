import {Box} from '@primer/react'
import {guard} from 'color2k'
import {scaleLinear} from 'd3-scale'
import produce from 'immer'
import React from 'react'
import {DraggableCore} from 'react-draggable'
import useMeasure from 'react-use-measure'
import {falloffWeight} from '../falloff'

function round(num: number, step: number) {
  return Math.round(num * (1 / step)) / (1 / step)
}

// An svg gradient is referenced by id, so every editor on the page needs its
// own. React 17 has no useId.
let gradientCount = 0

// How far one arrow press moves a value, and how far Shift+Arrow moves it --
// the "same thing, bigger" step every design tool spells this way.
const NUDGE = 1
const NUDGE_LARGE = 10

// What the line's white is worth at rest, and what's left of it outside the
// radius once proportional editing is reaching.
//
// The reach is marked by dropping the columns that stay put, not by lifting the
// ones that move. Brightness alone cannot be trusted with it: there is only 0.5
// of headroom above the resting line, and how much of that the outermost column
// gets is entirely up to the falloff's tail -- under a curve with a slack one it
// lands a few thousandths above resting and the boundary vanishes. The tail is a
// tuning knob (see falloffWeight), so a boundary cue that reads only while it
// happens to be full is a cue that breaks the next time it is turned. Dimming
// answers "in play or not", which no curve can argue with, and leaves the glow
// free to go on meaning only "this much".
const RESTING_ALPHA = 0.5
const DIM_ALPHA = 0.2

// Fading a whole editor by this lands its line on exactly DIM_ALPHA, so one
// rule covers everything the current point isn't moving, whether that's the far
// end of its own curve or another curve entirely. Its handles come to rest
// above that: the curve is out of play, but its points can still be picked up.
const DIMMED_CURVE_OPACITY = DIM_ALPHA / RESTING_ALPHA

type CurveEditorProps = {
  values: number[]
  min: number
  max: number
  step?: number
  onChange?: (values: number[], index?: number) => void
  onFocus?: (index: number) => void
  onBlur?: () => void
  disabled?: boolean
  // Per-point lock: a locked point can still be focused/selected, but not
  // dragged or nudged with the keyboard, and renders its handle gray.
  lockedIndices?: boolean[]
  // Proportional editing: how many points to each side of the one being moved
  // follow along, their share of the movement easing off with distance. 0 (the
  // default) moves only the point itself.
  proportionalRadius?: number
  // Set while another curve has a point in hand, to let this one recede behind
  // the one being worked on.
  dimmed?: boolean
  label?: string
  style?: React.SVGAttributes<SVGSVGElement>['style']
}

export type CurveEditorHandle = {
  focusPoint: (index: number) => void
  focusLine: () => void
}

// TODO: snap to guides
// TODO: label
export const CurveEditor = React.forwardRef<CurveEditorHandle, CurveEditorProps>(function CurveEditor(
  {
    values,
    min,
    max,
    onChange,
    onFocus,
    onBlur,
    step = 0.1,
    disabled = false,
    lockedIndices = [],
    proportionalRadius = 0,
    dimmed = false,
    label = '',
    style = {}
  },
  handleRef
) {
  const [ref, {width, height}] = useMeasure()
  const nodeRadius = 20
  const columnWidth = width / values.length
  const [dragging, setDragging] = React.useState<number | 'line' | false>(false)
  const [focused, setFocused] = React.useState<number | 'line' | false>(false)
  const pointRefs = React.useRef<(SVGGElement | null)[]>([])
  const lineRef = React.useRef<SVGGElement | null>(null)

  React.useImperativeHandle(handleRef, () => ({
    focusPoint: index => pointRefs.current[index]?.focus(),
    focusLine: () => lineRef.current?.focus()
  }))

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const xScale = React.useCallback(
    scaleLinear()
      .domain([0, values.length - 1])
      .range([columnWidth / 2, width - columnWidth / 2]),
    [values.length, width, columnWidth]
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const yScale = React.useCallback(
    scaleLinear()
      .domain([min, max])
      .range([height - nodeRadius, nodeRadius]),
    [min, max, height, nodeRadius]
  )

  const points = React.useMemo(
    () => values.map((value, index) => ({x: xScale(index), y: yScale(value)})),
    [values, xScale, yScale]
  )

  // Where proportional editing has carried each neighbor so far, before the
  // rounding to `step` that the committed values get. A drag arrives as a
  // stream of small deltas, and a far neighbor's share of any one of them can
  // be smaller than a step: rounding each frame in isolation would floor those
  // shares to zero and leave the outer points behind on a slow drag. Summing
  // here and rounding only on the way out lets them accumulate.
  const spreadValues = React.useRef<number[] | null>(null)

  const gradientId = React.useMemo(() => `curve-influence-${gradientCount++}`, [])

  // Paints the whole line while proportional editing is reaching: the point
  // being moved burns to full white, its neighbors carry the falloff weight
  // itself so the picture cannot drift from the math that moves them, and the
  // columns that stay put drop to DIM_ALPHA.
  //
  // A horizontal gradient can carry this because the columns are evenly spaced
  // and the curve runs strictly left to right: every index owns exactly one x.
  // Which also means the boundary lands where it should on its own. A segment
  // moves if either of its ends does, so the one leaving the radius is half in
  // play -- and the gradient renders it as exactly that, a fade from the last
  // moving column to the first still one, rather than a step that would have to
  // pick a side and misreport it.
  const influence = React.useMemo(() => {
    const activeIndex = typeof dragging === 'number' ? dragging : typeof focused === 'number' ? focused : null
    if (activeIndex === null || !proportionalRadius || lockedIndices[activeIndex] || values.length < 2) return null

    const stops = Array.from({length: values.length}, (_, index) => {
      const distance = Math.abs(index - activeIndex)
      return {
        offset: index / (values.length - 1),
        opacity:
          distance > proportionalRadius
            ? DIM_ALPHA
            : RESTING_ALPHA + (1 - RESTING_ALPHA) * falloffWeight(distance, proportionalRadius)
      }
    })

    return {x1: xScale(0), x2: xScale(values.length - 1), stops}
  }, [dragging, focused, proportionalRadius, lockedIndices, values.length, xScale])

  // Hands `delta` down from the point at `sourceIndex` to the points within the
  // proportional radius, easing it off with distance. Distance is counted in
  // columns and ignores locks, so a locked column holds only its own point
  // still -- the falloff carries through it to the columns beyond, which land
  // where they would have if it were free.
  const spread = React.useCallback(
    (draft: number[], accumulated: number[], sourceIndex: number, delta: number) => {
      if (!proportionalRadius || !delta) return

      const first = Math.max(0, sourceIndex - proportionalRadius)
      const last = Math.min(values.length - 1, sourceIndex + proportionalRadius)

      for (let index = first; index <= last; index++) {
        if (index === sourceIndex || lockedIndices[index]) continue
        const weight = falloffWeight(Math.abs(index - sourceIndex), proportionalRadius)
        accumulated[index] = guard(min, max, accumulated[index] + delta * weight)
        draft[index] = round(accumulated[index], step)
      }
    },
    [proportionalRadius, values.length, lockedIndices, min, max, step]
  )

  return (
    <svg
      ref={ref}
      width="100%"
      height="100%"
      fill="none"
      pointerEvents="none"
      opacity={disabled ? 0.5 : dimmed ? DIMMED_CURVE_OPACITY : 1}
      // Allow the H/S/L label to render in the left gutter (negative x) instead
      // of being clipped by the svg viewport when columns get narrow. The graph
      // column reserves matching left padding in scale.tsx.
      style={{position: 'relative', overflow: 'visible'}}
      onKeyDown={event => {
        // Alt/Option+Arrow is reserved for switching scales (handled by the
        // page that hosts this editor), so let it bubble up untouched.
        if (event.altKey) return

        let direction: number | undefined
        switch (event.key) {
          case 'ArrowUp':
            direction = 1
            break
          case 'ArrowDown':
            direction = -1
            break
        }

        if (direction) {
          const delta = direction * (event.shiftKey ? NUDGE_LARGE : NUDGE)

          if (focused === 'line') {
            const clampedDelta = values.reduce((acc, value) => {
              if (value + acc < min) {
                return min - value
              }

              if (value + acc > max) {
                return max - value
              }

              return acc
            }, delta)

            onChange?.(values.map(value => round(value + clampedDelta, step)))
          } else if (typeof focused === 'number' && !lockedIndices[focused]) {
            onChange?.(
              produce(values, draft => {
                const value = guard(min, max, yScale.invert(points[focused].y) + delta)
                draft[focused] = round(value, step)
                // A nudge is one discrete step rather than a stream of deltas,
                // so it needs no accumulator carried between events. Reading the
                // delta back off the draft rather than using `delta` keeps the
                // neighbors in step with a point that clamped at min or max.
                spread(draft, [...values], focused, draft[focused] - values[focused])
              }),
              focused
            )
          }
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          if (typeof focused === 'number') {
            const neighbor = focused + (event.key === 'ArrowRight' ? 1 : -1)
            pointRefs.current[Math.max(0, Math.min(values.length - 1, neighbor))]?.focus()
          }
        }
      }}
    >
      {influence ? (
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={influence.x1} x2={influence.x2}>
            {influence.stops.map(({offset, opacity}) => (
              <stop key={offset} offset={offset} stopColor="white" stopOpacity={opacity} />
            ))}
          </linearGradient>
        </defs>
      ) : null}

      <DraggableCore
        disabled={disabled}
        onStart={() => setDragging('line')}
        onStop={() => setDragging(false)}
        onDrag={(_, data) => {
          const delta = yScale.invert(points[0].y + data.deltaY) - yScale.invert(points[0].y)

          const clampedDelta = values.reduce((acc, value) => {
            if (value + acc < min) {
              return min - value
            }

            if (value + acc > max) {
              return max - value
            }

            return acc
          }, delta)

          onChange?.(values.map(value => round(value + clampedDelta, step)))
        }}
      >
        <Box
          as="g"
          ref={lineRef}
          pointerEvents={disabled || (dragging !== false && dragging !== 'line') ? 'none' : 'all'}
          sx={{
            outline: 'none',
            '& .target': {
              opacity: dragging === 'line' ? 1 : 0
            },
            '&:hover .target': {
              opacity: 1
            }
          }}
          onFocus={() => {
            setFocused('line')
          }}
          onBlur={() => {
            setFocused(false)
          }}
          tabIndex={disabled ? undefined : 0}
        >
          <polyline
            className="target"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth={nodeRadius * 2}
            points={points.map(({x, y}) => `${x},${y}`).join(' ')}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {!disabled ? (
            <>
              {/* While proportional editing reaches, the line's alpha varies
                  along its length, so it comes from the gradient's stops rather
                  than one opacity for the whole stroke. */}
              <polyline
                stroke={influence ? `url(#${gradientId})` : 'white'}
                strokeWidth={focused === 'line' ? 6 : 4}
                points={points.map(({x, y}) => `${x},${y}`).join(' ')}
                strokeLinejoin="round"
                opacity={focused === 'line' || influence ? 1 : RESTING_ALPHA}
              />
              {focused === 'line' ? (
                <Box
                  as="polyline"
                  className="line-focus-ring"
                  points={points.map(({x, y}) => `${x},${y}`).join(' ')}
                  strokeLinejoin="round"
                  fill="none"
                  sx={{
                    stroke: (theme: any) => theme.colors.accent.emphasis
                  }}
                  strokeWidth="2"
                />
              ) : null}
            </>
          ) : (
            <polyline
              stroke="white"
              strokeWidth={2}
              points={points.map(({x, y}) => `${x},${y}`).join(' ')}
              strokeLinejoin="round"
            />
          )}
        </Box>
      </DraggableCore>

      {points.map(({x, y}, index) => {
        const locked = Boolean(lockedIndices[index])

        return (
          <DraggableCore
            key={index}
            disabled={disabled || locked}
            onStart={() => {
              spreadValues.current = [...values]
              setDragging(index)
            }}
            onStop={() => {
              spreadValues.current = null
              setDragging(false)
            }}
            onDrag={(_, data) => {
              onChange?.(
                produce(values, draft => {
                  const value = guard(min, max, yScale.invert(y + data.deltaY))
                  draft[index] = round(value, step)
                  // Neighbors follow how far this point actually got, not how
                  // far the pointer asked it to go, so once it is pinned at min
                  // or max the rest of the curve stops with it.
                  spread(draft, spreadValues.current ?? [...values], index, value - values[index])
                }),
                index
              )
            }}
          >
            <Box
              as="g"
              ref={el => (pointRefs.current[index] = el)}
              pointerEvents={disabled ? 'none' : 'all'}
              sx={{
                '& .target': {
                  opacity: dragging === index ? 1 : 0
                },
                '&:hover .target': {
                  opacity: 1
                },
                '&:focus': {
                  outline: 'none'
                }
              }}
              onFocus={() => {
                setFocused(index)
                onFocus?.(index)
              }}
              onBlur={() => {
                setFocused(false)
                onBlur?.()
              }}
              tabIndex={disabled ? undefined : 0}
            >
              <circle
                className="target"
                cx={x}
                cy={y}
                r={nodeRadius}
                fill="rgba(0,0,0,0.1)"
                style={{transformOrigin: `${x}px ${y}px`}}
              />
              {!disabled ? (
                <>
                  <circle
                    className="border"
                    cx={x}
                    cy={y}
                    r={focused === index || focused === 'line' ? 10.5 : 8.5}
                    fill="none"
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth="1"
                  />
                  <circle
                    className="handle"
                    cx={x}
                    cy={y}
                    r={focused === index || focused === 'line' ? 10 : 8}
                    fill={locked ? 'var(--color-border, #8c8c8c)' : 'white'}
                  />
                  {focused === index || focused === 'line' ? (
                    <Box
                      as="circle"
                      className="focus-ring"
                      cx={x}
                      cy={y}
                      r={7}
                      fill="none"
                      strokeWidth="2"
                      sx={{
                        stroke: (theme: any) => theme.colors.accent.emphasis
                      }}
                    />
                  ) : null}
                </>
              ) : (
                <circle className="node-handle" cx={x} cy={y} r={4} fill="white" />
              )}

              {index === 0 ? (
                // Pinned to the left gutter (x < 0, rendered via the svg's
                // overflow: visible) so it stays put and readable regardless of
                // column width. y still tracks this curve's first point.
                <text
                  x={-8}
                  y={y}
                  fill="currentColor"
                  style={{
                    textTransform: 'uppercase',
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: 14,
                    lineHeight: 1
                  }}
                  textAnchor="end"
                  alignmentBaseline="middle"
                >
                  {label}
                </text>
              ) : null}
            </Box>
          </DraggableCore>
        )
      })}
    </svg>
  )
})
