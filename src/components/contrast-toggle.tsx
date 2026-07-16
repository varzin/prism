import {Tooltip} from '@primer/react/drafts'
import {LucideIcon, PaintBucket, Pipette} from 'lucide-react'
import {ButtonGroup, IconButton} from './button'

// What the per-swatch contrast scores are measured against.
//   'selected'   — the currently selected color in the scale (relative contrast)
//   'background' — the palette's background color
export type ContrastMode = 'selected' | 'background'

const OPTIONS: {value: ContrastMode; label: string; icon: LucideIcon}[] = [
  {value: 'selected', label: 'Relative contrast', icon: Pipette},
  {value: 'background', label: 'Background contrast', icon: PaintBucket}
]

// A segmented control for choosing what contrast is measured against, styled to
// match the curve-visibility button group it sits next to in the toolbar. The
// options are icon-only; their tooltips carry the label.
export function ContrastToggle({value, onChange}: {value: ContrastMode; onChange: (mode: ContrastMode) => void}) {
  return (
    <ButtonGroup role="group" aria-label="Measure contrast against">
      {OPTIONS.map(({value: optionValue, label, icon: Icon}) => {
        const active = value === optionValue
        return (
          <Tooltip key={optionValue} text={label} direction="s">
            <IconButton
              aria-label={label}
              aria-pressed={active}
              icon={() => <Icon size={16} />}
              onClick={() => onChange(optionValue)}
            />
          </Tooltip>
        )
      })}
    </ButtonGroup>
  )
}
