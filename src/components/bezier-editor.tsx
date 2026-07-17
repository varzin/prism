import {Box} from '@primer/react'
import React from 'react'
import {DraggableCore} from 'react-draggable'
import useMeasure from 'react-use-measure'
import styled from 'styled-components'
import {curveFunction} from '../easings'
import {BezierPoints} from '../types'
import {clamp} from '../utils'
import {Input} from './input'
import {VStack} from './stack'

// Four fields in a 300px panel have no room for spinners, and a control point is
// dragged far more often than it is typed.
const CoordinateField = styled(Input)`
  width: 100%;
  min-width: 0;
  -moz-appearance: textfield;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`

// The unit square, plus a margin the handles and the end swatches can sit on
// without their circles being clipped at the corners.
const SIZE = 100
const PAD = 14
const VIEW = SIZE + PAD * 2

const NUDGE = 0.01
const NUDGE_LARGE = 0.1

const toX = (x: number) => PAD + x * SIZE
const toY = (y: number) => PAD + (1 - y) * SIZE
const round = (value: number) => Math.round(value * 100) / 100

type BezierEditorProps = {
  points: BezierPoints
  // The scale's colors, in order. Drawn on the curve at the position each one is
  // sampled from -- see the swatch dots below.
  sampleColors: string[]
  onChange: (points: BezierPoints) => void
}

const COORDINATES: {index: 0 | 1 | 2 | 3; label: string}[] = [
  {index: 0, label: 'X1'},
  {index: 1, label: 'Y1'},
  {index: 2, label: 'X2'},
  {index: 3, label: 'Y2'}
]

// The usual cubic-bezier editor, with one thing the usual one has no way to
// know: this curve is not read continuously. It is sampled at exactly as many
// points as the scale has colors, and each sample is a color you can look at.
// So the samples are drawn on the curve in their own colors -- bend the curve
// and you watch the palette redistribute, which is the whole point of the panel.
//
// Both axes are pinned to 0..1: x because bezier-easing needs a function of x, y
// so the curve stays inside its own endpoints and every color it computes stays
// a color (see BezierPoints).
export function BezierEditor({points, sampleColors, onChange}: BezierEditorProps) {
  const [ref, {width}] = useMeasure()
  const [x1, y1, x2, y2] = points

  const easing = React.useMemo(() => curveFunction({custom: points}), [points])

  // The svg is scaled to its box, so a pointer delta in px has to be taken back
  // through that scale before it means anything in curve space.
  const toCurveDelta = React.useCallback(
    (dx: number, dy: number) => {
      const scale = width ? VIEW / width : 0
      return {dx: (dx * scale) / SIZE, dy: (-dy * scale) / SIZE}
    },
    [width]
  )

  const move = React.useCallback(
    (handle: 0 | 1, dx: number, dy: number) => {
      const next = [...points] as BezierPoints
      const xi = handle === 0 ? 0 : 2
      const yi = handle === 0 ? 1 : 3
      next[xi] = round(clamp(points[xi] + dx, 0, 1))
      next[yi] = round(clamp(points[yi] + dy, 0, 1))
      onChange(next)
    },
    [points, onChange]
  )

  const setCoordinate = React.useCallback(
    (index: number, value: number) => {
      const next = [...points] as BezierPoints
      next[index] = round(clamp(value, 0, 1))
      onChange(next)
    },
    [points, onChange]
  )

  const handles = [
    {index: 0 as const, x: x1, y: y1, anchorX: 0, anchorY: 0, name: 'First'},
    {index: 1 as const, x: x2, y: y2, anchorX: 1, anchorY: 1, name: 'Second'}
  ]

  // Every color sits where the curve puts it: x is its even share of the scale,
  // y is what the curve makes of that. Under three colors there is nothing in
  // between the ends for the curve to place.
  const samples =
    sampleColors.length >= 2
      ? sampleColors.map((color, index) => {
          const x = index / (sampleColors.length - 1)
          return {color, x, y: easing(x)}
        })
      : []

  return (
    <VStack spacing={8}>
      <Box
        ref={ref}
        as="svg"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        width="100%"
        sx={{
          display: 'block',
          aspectRatio: '1 / 1',
          borderRadius: 6,
          border: '1px solid var(--color-border, gray)',
          // A window rather than a slab: the same bordered field the Input and
          // Select above it are, so the panel reads as one instrument. A tinted
          // fill would also mute the swatches, which are the thing to look at.
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
          touchAction: 'none'
        }}
      >
        {/* What no curve at all would look like, to read the bend against. The
            field carries no grid: the four fields below give exact coordinates,
            which is all a grid would have offered, and this line says the one
            thing they cannot. */}
        <line
          x1={toX(0)}
          y1={toY(0)}
          x2={toX(1)}
          y2={toY(1)}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeDasharray="2 4"
          strokeLinecap="round"
        />

        {handles.map(handle => (
          <line
            key={`leash-${handle.index}`}
            x1={toX(handle.anchorX)}
            y1={toY(handle.anchorY)}
            x2={toX(handle.x)}
            y2={toY(handle.y)}
            stroke="currentColor"
            strokeOpacity={0.25}
          />
        ))}

        {/* Quiet on purpose. The curve is the armature; the colors on it are
            what there is to look at, and they can only be the boldest thing here
            if everything holding them up is not. */}
        <path
          d={`M ${toX(0)},${toY(0)} C ${toX(x1)},${toY(y1)} ${toX(x2)},${toY(y2)} ${toX(1)},${toY(1)}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* The signature: the scale itself, beaded onto the curve. Ringed in ink
            rather than in the background color, or the palest swatches of a
            scale would come out white on white and simply vanish. */}
        {samples.map((sample, index) => (
          <circle
            key={index}
            cx={toX(sample.x)}
            cy={toY(sample.y)}
            r={4}
            fill={sample.color}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
        ))}

        {handles.map(handle => (
          <DraggableCore
            key={handle.index}
            onDrag={(_, data) => {
              const {dx, dy} = toCurveDelta(data.deltaX, data.deltaY)
              move(handle.index, dx, dy)
            }}
          >
            <Box
              as="g"
              tabIndex={0}
              role="button"
              aria-label={`${handle.name} control point, x ${handle.x}, y ${handle.y}`}
              sx={{
                cursor: 'grab',
                outline: 'none',
                '&:active': {cursor: 'grabbing'},
                '& .grip': {transition: 'r 80ms ease, stroke-opacity 80ms ease'},
                '@media (prefers-reduced-motion: reduce)': {'& .grip': {transition: 'none'}},
                // Quiet at rest, definite under the hand.
                '&:hover .grip, &:focus-visible .grip': {r: 6.5, strokeOpacity: 1},
                '&:focus-visible .ring': {opacity: 1}
              }}
            >
              {/* Bigger than it looks, so it can be grabbed at the edges. */}
              <circle cx={toX(handle.x)} cy={toY(handle.y)} r={11} fill="transparent" />
              <Box
                as="circle"
                className="ring"
                cx={toX(handle.x)}
                cy={toY(handle.y)}
                r={9}
                fill="none"
                strokeWidth={2}
                sx={{opacity: 0, stroke: (theme: any) => theme.colors.accent.emphasis}}
              />
              {/* Hollow, so it reads as a thing to grab rather than another
                  swatch, and so a swatch underneath it stays visible. Kept light
                  for the same reason the curve is; the leash pointing at it is
                  what makes it findable, not its weight. */}
              <Box
                as="circle"
                className="grip"
                cx={toX(handle.x)}
                cy={toY(handle.y)}
                r={5}
                fill="var(--color-background)"
                stroke="currentColor"
                strokeWidth={1.25}
                sx={{strokeOpacity: 0.5}}
              />
            </Box>
          </DraggableCore>
        ))}
      </Box>

      {/* Two pairs, not four numbers: the gap between them is what says which
          coordinates belong to which control point. */}
      <Box sx={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3}}>
        {[0, 1].map(pair => (
          <Box key={pair} sx={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2}}>
            {COORDINATES.slice(pair * 2, pair * 2 + 2).map(coordinate => (
              <CoordinateInput
                key={coordinate.label}
                label={coordinate.label}
                value={points[coordinate.index]}
                onCommit={value => setCoordinate(coordinate.index, value)}
              />
            ))}
          </Box>
        ))}
      </Box>
    </VStack>
  )
}

// The field is free text while it has focus so the number can be cleared and
// retyped; only values that parse are committed, and blur snaps the text back to
// whatever the point actually ended up at -- including after a drag moved it.
function CoordinateInput({label, value, onCommit}: {label: string; value: number; onCommit: (value: number) => void}) {
  const [draft, setDraft] = React.useState(String(value))

  React.useEffect(() => setDraft(String(value)), [value])

  return (
    <VStack spacing={4}>
      <Box as="label" htmlFor={`bezier-${label}`} sx={{fontSize: 0, opacity: 0.6}}>
        {label}
      </Box>
      <CoordinateField
        id={`bezier-${label}`}
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={draft}
        onChange={event => {
          setDraft(event.target.value)
          const parsed = parseFloat(event.target.value)
          if (!Number.isNaN(parsed)) onCommit(parsed)
        }}
        onBlur={() => setDraft(String(value))}
      />
    </VStack>
  )
}
