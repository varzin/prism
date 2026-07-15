import {Box} from '@primer/react'
import {LucideIcon, PaintBucket, Pipette} from 'lucide-react'

// What the per-swatch contrast scores are measured against.
//   'selected'   — the currently selected color in the scale (relative contrast)
//   'background' — the palette's background color
export type ContrastMode = 'selected' | 'background'

const OPTIONS: {value: ContrastMode; label: string; icon: LucideIcon}[] = [
  {value: 'selected', label: 'Selected', icon: Pipette},
  {value: 'background', label: 'Background', icon: PaintBucket}
]

// A themed segmented control for choosing what contrast is measured against.
// The active segment inverts to --color-text / --color-background, which stays
// readable on any palette background by construction.
export function ContrastToggle({value, onChange}: {value: ContrastMode; onChange: (mode: ContrastMode) => void}) {
  return (
    <Box
      role="group"
      aria-label="Measure contrast against"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 32,
        p: '2px',
        gap: '2px',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        backgroundColor: 'var(--color-background-secondary)'
      }}
    >
      {OPTIONS.map(({value: optionValue, label, icon: Icon}) => {
        const active = value === optionValue
        return (
          <Box
            key={optionValue}
            as="button"
            type="button"
            aria-pressed={active}
            onClick={() => onChange(optionValue)}
            sx={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              height: '100%',
              borderRadius: 4,
              fontSize: 1,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              color: active ? 'var(--color-background)' : 'var(--color-text)',
              backgroundColor: active ? 'var(--color-text)' : 'transparent',
              opacity: active ? 1 : 0.6,
              transition: 'background-color 80ms, color 80ms, opacity 80ms',
              '&:hover': {
                opacity: 1,
                backgroundColor: active ? 'var(--color-text)' : 'var(--color-background-secondary-hover)'
              },
              '&:focus-visible': {
                outline: '2px solid var(--color-accent-emphasis, #0969da)',
                outlineOffset: '1px'
              }
            }}
          >
            <Icon size={14} />
            {label}
          </Box>
        )
      })}
    </Box>
  )
}
