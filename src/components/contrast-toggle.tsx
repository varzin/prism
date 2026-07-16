import {ButtonGroup} from '@primer/react'
import {LucideIcon, PaintBucket, Pipette} from 'lucide-react'
import {Button} from './button'

// What the per-swatch contrast scores are measured against.
//   'selected'   — the currently selected color in the scale (relative contrast)
//   'background' — the palette's background color
export type ContrastMode = 'selected' | 'background'

const OPTIONS: {value: ContrastMode; label: string; icon: LucideIcon}[] = [
  {value: 'selected', label: 'Selected', icon: Pipette},
  {value: 'background', label: 'Background', icon: PaintBucket}
]

// A segmented control for choosing what contrast is measured against, styled to
// match the curve-visibility button group it sits next to in the toolbar.
export function ContrastToggle({value, onChange}: {value: ContrastMode; onChange: (mode: ContrastMode) => void}) {
  return (
    <ButtonGroup role="group" aria-label="Measure contrast against">
      {OPTIONS.map(({value: optionValue, label, icon: Icon}) => {
        const active = value === optionValue
        return (
          <Button
            key={optionValue}
            aria-pressed={active}
            onClick={() => onChange(optionValue)}
            leadingVisual={() => <Icon size={14} />}
            style={{
              background: active ? 'var(--color-background-secondary)' : 'var(--color-background)'
            }}
          >
            {label}
          </Button>
        )
      })}
    </ButtonGroup>
  )
}
