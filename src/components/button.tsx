import {ButtonGroup as PrimerButtonGroup, Button as PrimerButton, IconButton as PrimerIconButton} from '@primer/react'
import styled from 'styled-components'

// Primer's ButtonGroup squares off the inner corners of its *direct* children to
// form a segmented control. Tooltip wraps each trigger in an inline-block Box, so
// those rules land on the wrapper and the buttons keep their own rounded corners.
// Re-apply them one level deeper for groups whose buttons have tooltips.
export const ButtonGroup = styled(PrimerButtonGroup)`
  && > * > button {
    position: relative;
    border-radius: 0;
  }

  && > *:first-child > button {
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
  }

  && > *:last-child > button {
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
  }

  && > * > button:focus,
  && > * > button:active,
  && > * > button:hover {
    z-index: 1;
  }
`

// Buttons sit on the palette background; the secondary gray is reserved for the
// "on" half of a toggle (aria-pressed) and the active segment of a segmented
// control, so a gray fill in the UI always means "this is switched on".
export const Button = styled(PrimerButton)`
  color: var(--color-text);
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  box-shadow: none;
  margin: 0;

  &:not([disabled]):hover,
  &:not([disabled]):active {
    background-color: var(--color-background-secondary);
    border-color: var(--color-border);
  }

  &[aria-pressed='true'] {
    background-color: var(--color-background-secondary);
  }

  &[aria-pressed='true']:not([disabled]):hover,
  &[aria-pressed='true']:not([disabled]):active {
    background-color: var(--color-background-secondary-hover);
  }

  &[disabled] {
    color: var(--color-text);
    opacity: 0.5;
  }
`

export const IconButton = styled(PrimerIconButton)<{$transparent?: boolean}>`
  color: var(--color-text);
  background-color: ${props => (props.$transparent ? 'transparent' : 'var(--color-background)')};
  border: ${props => (props.$transparent ? '1px solid transparent' : '1px solid var(--color-border)')};
  box-shadow: none;
  margin: 0;

  &:not([disabled]):hover {
    background-color: var(--color-background-secondary);
  }

  &[aria-pressed='true'] {
    background-color: var(--color-background-secondary);
  }

  &[aria-pressed='true']:not([disabled]):hover {
    background-color: var(--color-background-secondary-hover);
  }

  &[disabled] {
    color: var(--color-text);
    opacity: 0.5;
  }
`
