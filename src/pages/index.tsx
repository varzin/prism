import {Palette as PaletteIcon, Pencil, Plus, Trash2} from 'lucide-react'
import {Box, Label} from '@primer/react'
import {mix, readableColor} from 'color2k'
import React from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {v4 as uniqueId} from 'uuid'
import {icon16, IconButton} from '../components/button'
import {Input} from '../components/input'
import {NewPaletteDialog} from '../components/new-palette-dialog'
import {routePrefix} from '../constants'
import {useGlobalState} from '../global-state'
import {colorToHex} from '../utils'

// Each card wears its own palette's colors, so the controls sitting on it can't
// take them from an ancestor the way everything inside the editor does. Setting
// the same variables per card lets Button, IconButton and Input stay unchanged.
function paletteColors(backgroundColor: string) {
  const text = readableColor(backgroundColor)

  return {
    '--color-text': text,
    '--color-background': backgroundColor,
    '--color-background-secondary': mix(text, backgroundColor, 0.9),
    '--color-background-secondary-hover': mix(text, backgroundColor, 0.85),
    '--color-border': mix(text, backgroundColor, 0.75)
  }
}

// Committing on blur as well as on Enter means the field has no way to trap you:
// clicking anywhere else keeps what you typed, which is what a bare text field
// with no Save button implies. Escape is the deliberate way out, so it has to
// beat the blur commit -- it cancels first and the unmount takes the blur with it.
function RenamePaletteForm({
  name,
  onSubmit,
  onCancel
}: {
  name: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = React.useState(name)

  return (
    <Box
      as="form"
      sx={{display: 'flex', flexGrow: 1, minWidth: 0}}
      onSubmit={(event: React.FormEvent) => {
        event.preventDefault()
        onSubmit(draft.trim())
      }}
    >
      <Input
        autoFocus
        aria-label="Palette name"
        value={draft}
        style={{width: '100%'}}
        onChange={event => setDraft(event.target.value)}
        onFocus={event => event.target.select()}
        onBlur={() => onSubmit(draft.trim())}
        onKeyDown={event => {
          if (event.key === 'Escape') onCancel()
        }}
      />
    </Box>
  )
}

export function Index() {
  const [state, send] = useGlobalState()
  const navigate = useNavigate()
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)

  function createPalette(name: string, scales: Record<string, string[] | string>) {
    const paletteId = uniqueId()
    send({type: 'CREATE_PALETTE', paletteId, name, scales})
    setIsCreating(false)
    navigate(`${routePrefix}/local/${paletteId}`)
  }
  return (
    <div>
      <Box
        as="header"
        sx={{
          p: 3,
          bg: 'canvas.default',
          display: 'flex'
        }}
      >
        <Box sx={{display: 'flex', alignItems: 'center'}}>
          <PaletteIcon size={32} />
          <Box as="h1" sx={{m: 0, mx: 2, fontSize: 3, fontWeight: 'bold'}}>
            Nectary Prism
          </Box>
          <Label variant="accent">Beta</Label>
        </Box>
      </Box>
      <Box sx={{p: 3}}>
        <Box
          as="ul"
          sx={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 3,
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            lineClamp: 1
          }}
        >
          {Object.values(state.context.palettes).map(palette => (
            <Box
              as="li"
              key={palette.id}
              sx={{
                // The pencil is a second action on a card that already shows one;
                // at rest both would turn a wall of palettes into a wall of
                // buttons. Hover reveals it, focus-within keeps it reachable by
                // keyboard, and where there is no hover to speak of it just stays.
                '& .rename-action': {opacity: 0, transition: 'opacity 80ms ease'},
                '&:hover .rename-action, &:focus-within .rename-action': {opacity: 1},
                '@media (prefers-reduced-motion: reduce)': {'& .rename-action': {transition: 'none'}},
                '@media (hover: none)': {'& .rename-action': {opacity: 1}}
              }}
            >
              <Box
                p={3}
                sx={{
                  display: 'grid',
                  // A single implicit `auto` column would size to its content and
                  // pack left, leaving the swatch strip short of the right edge.
                  // Pinning it to one full-width track fills the card; minmax(0,…)
                  // lets the name row still truncate instead of forcing width.
                  gridTemplateColumns: 'minmax(0, 1fr)',
                  gap: 3,
                  borderRadius: '12px',
                  // A palette whose background matches the page would otherwise
                  // dissolve into it. The border is mixed from the palette's own
                  // colors -- a lighter blend than the editor's so it frames the
                  // card without drawing a hard line -- and a soft shadow lifts
                  // it off the page whatever its background.
                  border: '1px solid',
                  borderColor: mix(readableColor(palette.backgroundColor), palette.backgroundColor, 0.88),
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.06)',
                  overflow: 'hidden',
                  height: '100%',
                  ...paletteColors(palette.backgroundColor),
                  color: 'var(--color-text)',
                  backgroundColor: 'var(--color-background)'
                }}
              >
                {/* The swatches open the palette too -- they are the biggest
                    target on the card -- but as the same destination the name
                    already offers, so they stay out of the tab order and out of
                    the accessibility tree rather than saying it twice. */}
                <Box
                  as={Link}
                  to={`${routePrefix}/local/${palette.id}`}
                  tabIndex={-1}
                  aria-hidden="true"
                  sx={{
                    borderRadius: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    height: 160,
                    gap: 1
                  }}
                >
                  {Object.values(palette.scales)
                    .slice(0, 12)
                    .map(scale => (
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          color: readableColor(palette.backgroundColor),
                          backgroundColor: palette.backgroundColor,
                          height: '100%',
                          flexGrow: 1,
                          flexBasis: 0,
                          minWidth: 0,
                          borderRadius: '6px',
                          overflow: 'hidden',
                          // A hairline edge so a column whose colors sit close to
                          // the card background still reads as its own thing. It
                          // has to be a real border, not an inset shadow: the
                          // color cells fill the column and would paint over a
                          // shadow, but they sit inside the border box.
                          border: '1px solid rgba(0, 0, 0, 0.12)'
                        }}
                        key={scale.id}
                      >
                        {scale.colors.map((color, index) => {
                          return (
                            <Box
                              key={index}
                              style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: colorToHex(color)
                              }}
                            />
                          )
                        })}
                      </Box>
                    ))}
                </Box>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, minHeight: 32}}>
                  {renamingId === palette.id ? (
                    <RenamePaletteForm
                      name={palette.name}
                      onSubmit={name => {
                        if (name && name !== palette.name) {
                          send({type: 'CHANGE_PALETTE_NAME', paletteId: palette.id, name})
                        }

                        setRenamingId(null)
                      }}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <>
                      <Box
                        as={Link}
                        to={`${routePrefix}/local/${palette.id}`}
                        sx={{
                          minWidth: 0,
                          lineHeight: '24px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'inherit',
                          textDecoration: 'none'
                        }}
                      >
                        {palette.name}
                      </Box>
                      <IconButton
                        className="rename-action"
                        $transparent
                        aria-label={`Rename ${palette.name}`}
                        icon={icon16(Pencil)}
                        onClick={() => setRenamingId(palette.id)}
                      />
                      <IconButton
                        sx={{marginLeft: 'auto'}}
                        aria-label={`Delete ${palette.name}`}
                        icon={icon16(Trash2)}
                        onClick={() => {
                          send({type: 'DELETE_PALETTE', paletteId: palette.id})
                        }}
                      />
                    </>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
          {/* The create affordance is a card in its own right, sized like the
              palettes it sits beside. The dashed outline reads as an empty slot
              waiting to be filled rather than a solid thing of its own. */}
          <Box as="li">
            <Box
              as="button"
              type="button"
              aria-label="Create new palette"
              onClick={() => setIsCreating(true)}
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: '100%',
                height: '100%',
                minHeight: 240,
                p: 3,
                borderRadius: '12px',
                border: '2px dashed',
                borderColor: 'border.default',
                bg: 'transparent',
                color: 'fg.muted',
                cursor: 'pointer',
                transition: 'border-color 80ms ease, background-color 80ms ease, color 80ms ease',
                '&:hover': {borderColor: 'fg.muted', bg: 'canvas.subtle', color: 'fg.default'},
                '&:focus-visible': {outline: '2px solid', outlineColor: 'accent.emphasis', outlineOffset: '2px'}
              }}
            >
              <Plus size={48} />
            </Box>
          </Box>
        </Box>
      </Box>
      {isCreating ? <NewPaletteDialog onClose={() => setIsCreating(false)} onCreate={createPalette} /> : null}
    </div>
  )
}
