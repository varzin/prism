import React from 'react'
import {curvePoints, defaultCustomPoints, easingOptions, isCustomCurve, isEasingKey, roundPoints} from '../easings'
import {Channel, Curve} from '../types'
import {BezierEditor} from './bezier-editor'
import {Select} from './select'
import {SidebarPanel} from './sidebar-panel'
import {VStack} from './stack'

const LABELS: Record<Channel, string> = {
  hue: 'Hue',
  saturation: 'Saturation',
  lightness: 'Lightness'
}

const CUSTOM = 'custom'

type CurveSelectProps = {
  channel: Channel
  curve: Curve | undefined
  // Passed through to the editor, which draws them on the curve.
  sampleColors: string[]
  onChange: (curve: Curve | null) => void
}

// Picks what drives one channel of the selected scale. Titled by channel rather
// than showing all three at once: it reports the curve you have hold of, the way
// the Color panel below it reports the swatch you have hold of.
export function CurveSelect({channel, curve, sampleColors, onChange}: CurveSelectProps) {
  const custom = isCustomCurve(curve)
  const value = curve === undefined ? '' : custom ? CUSTOM : curve

  return (
    <SidebarPanel title={`Curve (${LABELS[channel]})`}>
      <VStack spacing={12}>
        <Select
          id={`curve-${channel}`}
          aria-label={`${LABELS[channel]} curve`}
          value={value}
          onChange={event => {
            const next = event.target.value
            if (isEasingKey(next)) return onChange(next)
            // Custom takes over from whatever was already driving the channel,
            // so it starts as an editable copy of that shape rather than a
            // reset. With nothing to copy it opens on a curve, not a line.
            if (next === CUSTOM) {
              return onChange({custom: curve === undefined ? defaultCustomPoints : roundPoints(curvePoints(curve))})
            }
            onChange(null)
          }}
        >
          <option value="">None</option>
          <option value={CUSTOM}>Custom</option>
          {easingOptions.map(option => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </Select>
        {custom ? (
          <BezierEditor
            points={curve.custom}
            sampleColors={sampleColors}
            onChange={points => onChange({custom: points})}
          />
        ) : null}
      </VStack>
    </SidebarPanel>
  )
}
