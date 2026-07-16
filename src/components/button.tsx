import {ButtonGroup as PrimerButtonGroup, Button as PrimerButton, IconButton as PrimerIconButton} from '@primer/react'
import {LucideIcon} from 'lucide-react'
import React from 'react'
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

const StyledIconButton = styled(PrimerIconButton)<{$transparent?: boolean}>`
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

const sizedIcons = new Map<LucideIcon, React.ComponentType>()

// Wraps a lucide icon at the 16px every button here wants, handing back the very
// same component for the same icon every time.
//
// The sizing is incidental; the identity is the point. Primer takes `icon` as a
// component *type* and renders <Icon />, so the obvious `icon={() => <X
// size={16} />}` hands it a brand new type on every render and React dutifully
// tears the icon's DOM down and builds it again each time.
//
// That stays invisible right up until a render lands between a press and its
// release -- a blur handler setting state as the button takes focus, say. Then
// mouseup arrives on a node that did not exist at mousedown and shares no
// ancestor with the one that did, the browser has nowhere to fire click, and the
// press is swallowed with no error anywhere: the button ignores you once, then
// works on the second try.
//
// Passing an icon that depends on state (icon16(open ? A : B)) is still fine.
// The identity changes only when the icon really does, which is a moment when
// rebuilding it is both correct and not in the middle of a click.
export function icon16(Icon: LucideIcon) {
  let sized = sizedIcons.get(Icon)

  if (!sized) {
    sized = () => <Icon size={16} />
    sizedIcons.set(Icon, sized)
  }

  return sized
}

export const IconButton = StyledIconButton
