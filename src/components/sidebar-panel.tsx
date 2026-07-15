import {Box, Text} from '@primer/react'
import {ChevronDown, ChevronRight} from 'lucide-react'
import React from 'react'

export function SidebarPanel({
  title,
  action,
  children,
  defaultOpen = true
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Box sx={{p: 3}}>
      <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: open ? 2 : 0}}>
        <Text as="h2" sx={{fontWeight: 'bold', fontSize: 2, m: 0, flex: 1, minWidth: 0}}>
          <Box
            as="button"
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(isOpen => !isOpen)}
            sx={{
              all: 'unset',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              width: '100%',
              cursor: 'pointer',
              color: 'var(--color-text)',
              '&:focus-visible': {
                outline: '2px solid var(--color-accent-emphasis, #0969da)',
                outlineOffset: '2px',
                borderRadius: 2
              }
            }}
          >
            <Box as="span" sx={{display: 'flex', flexShrink: 0}}>
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Box>
            <Box as="span" sx={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
              {title}
            </Box>
          </Box>
        </Text>
        {action}
      </Box>
      {open ? <Box>{children}</Box> : null}
    </Box>
  )
}
