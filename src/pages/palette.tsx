import {Palette as PaletteIcon, Redo2, Spline, Undo2, X} from 'lucide-react'
import {Box, Label, Text} from '@primer/react'
import {mix, readableColor} from 'color2k'
import React from 'react'
import {Link, Outlet, useNavigate, useParams} from 'react-router-dom'
import styled from 'styled-components'
import {Button, icon16, IconButton} from '../components/button'
import {ContrastMode} from '../components/contrast-toggle'
import {ExportScales} from '../components/export-scales'
import {FormatSettings} from '../components/format-settings'
import {ImportScales} from '../components/import-scales'
import {Separator} from '../components/separator'
import {SidebarPanel} from '../components/sidebar-panel'
import {HStack, VStack} from '../components/stack'
import {routePrefix} from '../constants'
import {useGlobalState} from '../global-state'
import {channels, Scale} from '../types'
import {colorToHex} from '../utils'

// Which of a scale's channels are driven by a curve, as the channel initials.
// Absent entirely when none are: the row is a list of scales first, and a mark
// that never goes away would stop being a mark.
//
// Each initial opens its own curve, so the badge answers "which channels are
// curved" and "take me to that one" with the same marks. That makes it a row of
// links rather than a label, which is why it is a sibling of the scale's link
// and not inside it -- a link cannot hold links.
function CurveBadge({scale}: {scale: Scale}) {
  const driven = channels.filter(channel => scale.curves?.[channel])

  if (driven.length === 0) return null

  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0}}>
      <Box as="span" aria-hidden="true" sx={{display: 'flex', opacity: 0.6}}>
        <Spline size={14} />
      </Box>
      <Box sx={{display: 'flex'}}>
        {driven.map(channel => (
          <Box
            key={channel}
            as={Link}
            to={`scale/${scale.id}`}
            state={{curve: channel}}
            aria-label={`Edit ${scale.name} ${channel} curve`}
            sx={{
              display: 'grid',
              placeItems: 'center',
              // Wider than the letter so there is something to hit, but tight
              // enough that the initials still read as one mark.
              width: 16,
              height: 18,
              borderRadius: 2,
              color: 'inherit',
              textDecoration: 'none',
              fontSize: 0,
              lineHeight: 1,
              opacity: 0.6,
              '&:hover': {opacity: 1, backgroundColor: 'var(--color-background-secondary-hover)'},
              '&:focus-visible': {
                opacity: 1,
                outline: '2px solid var(--color-accent-emphasis, #0969da)',
                outlineOffset: '1px'
              }
            }}
          >
            {channel[0].toUpperCase()}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

const Wrapper = styled.div<{backgroundColor: string; $sidebarOpen: boolean}>`
  --color-text: ${props => readableColor(props.backgroundColor)};
  --color-background: ${props => props.backgroundColor};
  --color-background-secondary: ${props => mix(readableColor(props.backgroundColor), props.backgroundColor, 0.9)};
  --color-background-secondary-hover: ${props =>
    mix(readableColor(props.backgroundColor), props.backgroundColor, 0.85)};
  --color-border: ${props => mix(readableColor(props.backgroundColor), props.backgroundColor, 0.75)};

  display: grid;
  grid-template-columns: ${props => (props.$sidebarOpen ? '300px 1fr' : '1fr')};
  grid-template-rows: auto 1fr;
  grid-template-areas: ${props => (props.$sidebarOpen ? "'header header' 'sidebar main'" : "'header' 'main'")};
  color: var(--color-text);
  background-color: var(--color-background);
  height: 100vh;
`

const Main = styled.main`
  grid-area: main;
  display: flex;
  overflow: auto;

  & > * {
    flex-grow: 1;
  }
`

// Which of the 3 columns (left scales list / center scale view / right fields)
// keyboard navigation is currently on. It lives here rather than in <Scale>
// because the left column is rendered by this component; <Scale> reads and
// writes it through the Outlet context.
export type ActivePanel = 'left' | 'center' | 'right' | null

export type PaletteOutletContext = {
  leftSidebarOpen: boolean
  setLeftSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
  contrastMode: ContrastMode
  setContrastMode: React.Dispatch<React.SetStateAction<ContrastMode>>
  activePanel: ActivePanel
  setActivePanel: React.Dispatch<React.SetStateAction<ActivePanel>>
}

export function Palette() {
  const {paletteId = '', scaleId} = useParams()
  const navigate = useNavigate()
  const [state, send] = useGlobalState()
  const [leftSidebarOpen, setLeftSidebarOpen] = React.useState(true)
  const [contrastMode, setContrastMode] = React.useState<ContrastMode>('selected')
  const [activePanel, setActivePanel] = React.useState<ActivePanel>(null)
  const palette = state.context.palettes[paletteId]

  if (!palette) {
    return (
      <div style={{padding: 16}}>
        <p style={{marginTop: 0}}>Palette not found</p>
        <Link to={`${routePrefix}/`}>Go home</Link>
      </div>
    )
  }

  return (
    <Wrapper backgroundColor={palette.backgroundColor} $sidebarOpen={leftSidebarOpen}>
      <header
        style={{
          gridArea: 'header',
          display: 'flex',
          alignItems: 'center',
          // gridTemplateColumns: "repeat(3,1fr)",
          justifyContent: 'space-between',
          padding: 16,
          borderBottom: '1px solid var(--color-border, gainsboro)'
        }}
      >
        <Link
          to={`${routePrefix}/`}
          style={{
            color: 'inherit',
            textDecoration: 'none'
          }}
        >
          <Text sx={{display: 'flex', alignItems: 'center'}}>
            <PaletteIcon size={32} />
            <Text as="h1" sx={{m: 0, mx: 2, fontSize: 3, fontWeight: 'bold'}}>
              Nectary Prism
            </Text>
            <Label variant="accent">Beta</Label>
          </Text>
        </Link>

        <HStack spacing={8}>
          <IconButton
            aria-label="Undo"
            icon={icon16(Undo2)}
            onClick={() => send('UNDO')}
            disabled={state.context.past.length === 0}
          >
            Undo
          </IconButton>
          <IconButton
            aria-label="Redo"
            icon={icon16(Redo2)}
            onClick={() => send('REDO')}
            disabled={state.context.future.length === 0}
          />
          {/* <input
            type="color"
            value={palette.backgroundColor}
            style={{
              appearance: "none",
              border: "1px solid var(--color-border, darkgray)",
              backgroundColor: "var(--color-background-secondary, gainsboro)",
              padding: "0px 2px",
              margin: 0,
              borderRadius: 3,
              height: 32,
            }}
            onChange={event =>
              send({
                type: "CHANGE_PALETTE_BACKGROUND_COLOR",
                paletteId,
                backgroundColor: event.target.value,
              })
            }
          /> */}
          <FormatSettings palette={palette} />
          <ImportScales
            format={palette.format}
            onImport={(scales, replace) => send({type: 'IMPORT_SCALES', paletteId, scales, replace})}
          />
          <ExportScales palette={palette} />
        </HStack>
      </header>
      <div
        style={{
          gridArea: 'sidebar',
          display: leftSidebarOpen ? 'block' : 'none',
          overflow: 'auto',
          borderRight: '1px solid var(--color-border, gainsboro)',
          paddingBottom: 16
        }}
      >
        <SidebarPanel
          title="Palette"
          // Renaming and deleting a palette both live on the home screen, next
          // to the card they act on. What is left here is the way back, and it
          // belongs beside the title rather than below the panel's contents --
          // it acts on the palette, not on the background color above it.
          action={
            <Button size="small" leadingVisual={icon16(X)} onClick={() => navigate(`${routePrefix}/`)}>
              Close palette
            </Button>
          }
        >
          <VStack spacing={16}>
            {/* The palette's name, shown for reference. Renaming lives on the
                home screen next to the card, so this is read-only here. */}
            <VStack spacing={4} style={{width: '100%'}}>
              <span style={{fontSize: 12, opacity: 0.7}}>Name</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {palette.name}
              </span>
            </VStack>
            <HStack spacing={8}>
              <input
                id="bg-color"
                type="color"
                value={palette.backgroundColor}
                style={{
                  appearance: 'none',
                  border: '1px solid var(--color-border, darkgray)',
                  backgroundColor: 'var(--color-background-secondary, gainsboro)',
                  padding: '0px 2px',
                  margin: 0,
                  borderRadius: 6,
                  height: 32,
                  width: 64
                }}
                onChange={event =>
                  send({
                    type: 'CHANGE_PALETTE_BACKGROUND_COLOR',
                    paletteId,
                    backgroundColor: event.target.value
                  })
                }
              />
              <label htmlFor="bg-color" style={{fontSize: 14}}>
                Background color
              </label>
            </HStack>
          </VStack>
        </SidebarPanel>
        <Separator />
        <SidebarPanel title="Scales">
          {/* Keeps activePanel in step with real focus the way the center and
              right panels do, so reaching the list by click, by Tab or by the [
              shortcut all mean the same thing. Scoped to the links rather than
              to the whole sidebar so focusing e.g. the palette name input above
              doesn't claim the panel. */}
          <VStack spacing={8} onFocusCapture={() => setActivePanel('left')}>
            {Object.values(palette.scales).map(scale => (
              <Box
                key={scale.id}
                sx={{
                  p: '4px',
                  borderRadius: 6,
                  backgroundColor: scale.id === scaleId ? 'var(--color-background-secondary)' : 'transparent'
                }}
              >
                <VStack spacing={4}>
                  <Box sx={{display: 'flex', alignItems: 'center', gap: 1, minHeight: 18}}>
                    <Box
                      as={Link}
                      id={`scale-link-${scale.id}`}
                      to={`scale/${scale.id}`}
                      sx={{
                        flexGrow: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'inherit',
                        fontSize: 14,
                        textDecoration: 'none'
                      }}
                    >
                      {scale.name}
                    </Box>
                    <CurveBadge scale={scale} />
                  </Box>
                  {/* The swatches open the scale too -- they are the biggest
                      target in the row -- but as the same destination the name
                      already offers, so they stay out of the tab order and out
                      of the accessibility tree rather than saying it twice. */}
                  <Box
                    as={Link}
                    to={`scale/${scale.id}`}
                    tabIndex={-1}
                    aria-hidden="true"
                    sx={{
                      display: 'flex',
                      height: 24,
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}
                  >
                    {scale.colors.map((color, index) => {
                      return (
                        <div
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
                </VStack>
              </Box>
            ))}
          </VStack>
          <Button style={{marginTop: 16, width: '100%'}} onClick={() => send({type: 'CREATE_SCALE', paletteId})}>
            New scale
          </Button>
        </SidebarPanel>
      </div>
      <Main>
        <Outlet
          context={{leftSidebarOpen, setLeftSidebarOpen, contrastMode, setContrastMode, activePanel, setActivePanel}}
        />
      </Main>
    </Wrapper>
  )
}
