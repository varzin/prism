import {Box} from '@primer/react'
import {Tooltip} from '@primer/react/drafts'
import {SplinePointer} from 'lucide-react'
import React from 'react'
import {icon16, IconButton} from './button'
import {Input} from './input'

const RADIUS_LABEL = 'Proportional editing radius'

// The tooltip reports the state the button is in rather than the state clicking
// it would reach, so it reads the same way as the pressed fill it sits on.
const label = (enabled: boolean) => `Proportional editing: ${enabled ? 'on' : 'off'}`

type ProportionalEditingToggleProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  radius: number
  onRadiusChange: (radius: number) => void
  // Largest useful radius: reaching every other point from either end.
  max: number
}

// Toggles proportional editing, and while it's on exposes its radius: how many
// columns to each side of a dragged point follow it, with the movement easing
// off the further out it goes (see falloffWeight in falloff.ts).
export function ProportionalEditingToggle({
  enabled,
  onEnabledChange,
  radius,
  onRadiusChange,
  max
}: ProportionalEditingToggleProps) {
  // The field is free text while it has focus so the number can be cleared and
  // retyped; only values that parse land on the committed radius, and blur
  // snaps the text back to whatever that ended up being.
  const [draft, setDraft] = React.useState(String(radius))

  React.useEffect(() => setDraft(String(radius)), [radius])

  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
      <Tooltip text={label(enabled)} direction="s">
        <IconButton
          aria-label={label(enabled)}
          aria-pressed={enabled}
          icon={icon16(SplinePointer)}
          onClick={() => onEnabledChange(!enabled)}
        />
      </Tooltip>
      {enabled ? (
        <Tooltip text={RADIUS_LABEL} direction="s">
          <Input
            type="number"
            min={1}
            max={max}
            step={1}
            aria-label={RADIUS_LABEL}
            value={draft}
            style={{width: 56}}
            onChange={event => {
              setDraft(event.target.value)
              const value = parseInt(event.target.value, 10)
              if (!Number.isNaN(value)) onRadiusChange(Math.max(1, Math.min(max, value)))
            }}
            onBlur={() => setDraft(String(radius))}
          />
        </Tooltip>
      ) : null}
    </Box>
  )
}
