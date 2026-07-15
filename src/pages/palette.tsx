import {CircleQuestionMark, Palette as PaletteIcon, Redo2, Undo2} from 'lucide-react'
import {AnchoredOverlay, Box, Text} from '@primer/react'
import {mix, readableColor} from 'color2k'
import React from 'react'
import {Link, Outlet, useNavigate, useParams} from 'react-router-dom'
import styled from 'styled-components'
import {Button, IconButton} from '../components/button'
import {ExportScales} from '../components/export-scales'
import {ImportScales} from '../components/import-scales'
import {Input} from '../components/input'
import {Separator} from '../components/separator'
import {SidebarPanel} from '../components/sidebar-panel'
import {HStack, VStack} from '../components/stack'
import {routePrefix} from '../constants'
import {useGlobalState} from '../global-state'
import {Color} from '../types'
import {colorToHex, getColor} from '../utils'

// Instructions for creating a curve, shown in the Curves "?" help popover.
function CurveInstructions() {
  return (
    <Text sx={{fontSize: 1, color: 'fg.muted'}}>
      Open a scale and press the{' '}
      <Text as="span" sx={{fontWeight: 'bold'}}>
        +
      </Text>{' '}
      next to Hue, Saturation, or Lightness curve to create a reusable curve from it.
    </Text>
  )
}

// A "?" button next to the Curves heading that reveals the creation
// instructions in a popover, so the guidance is reachable even once curves
// exist and the empty state is gone.
function CurvesHelp() {
  const [open, setOpen] = React.useState(false)
  return (
    <AnchoredOverlay
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      renderAnchor={anchorProps => (
        <Box
          as="button"
          type="button"
          aria-label="How to create a curve"
          {...anchorProps}
          sx={{
            all: 'unset',
            display: 'flex',
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-text)',
            opacity: 0.6,
            borderRadius: 2,
            '&:hover': {opacity: 1},
            '&:focus-visible': {
              outline: '2px solid var(--color-accent-emphasis, #0969da)',
              outlineOffset: '2px'
            }
          }}
        >
          <CircleQuestionMark size={16} />
        </Box>
      )}
      overlayProps={{role: 'dialog', 'aria-label': 'How to create a curve'}}
    >
      <Box sx={{p: 3, width: 240}}>
        <CurveInstructions />
      </Box>
    </AnchoredOverlay>
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

export type PaletteOutletContext = {
  leftSidebarOpen: boolean
  setLeftSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function Palette() {
  const {paletteId = ''} = useParams()
  const navigate = useNavigate()
  const [state, send] = useGlobalState()
  const [leftSidebarOpen, setLeftSidebarOpen] = React.useState(true)
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
              Primer Prism
            </Text>
          </Text>
        </Link>

        <HStack spacing={8}>
          <IconButton
            aria-label="Undo"
            icon={() => <Undo2 size={16} />}
            onClick={() => send('UNDO')}
            disabled={state.context.past.length === 0}
          >
            Undo
          </IconButton>
          <IconButton
            aria-label="Redo"
            icon={() => <Redo2 size={16} />}
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
          <ImportScales onImport={(scales, replace) => send({type: 'IMPORT_SCALES', paletteId, scales, replace})} />
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
        <SidebarPanel title="Palette">
          <VStack spacing={16}>
            <VStack spacing={4}>
              <label htmlFor="palette-name" style={{fontSize: 14}}>
                Name
              </label>
              <Input
                type="text"
                id="palette-name"
                value={palette.name}
                style={{width: '100%'}}
                onChange={event =>
                  send({
                    type: 'CHANGE_PALETTE_NAME',
                    paletteId,
                    name: event.target.value
                  })
                }
              />
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
            <Button
              aria-label="Delete palette"
              onClick={() => {
                send({type: 'DELETE_PALETTE', paletteId})

                // Navigate to home page after deleting a palette
                navigate(`${routePrefix}/`)
              }}
            >
              Delete palette
            </Button>
          </VStack>
        </SidebarPanel>
        <Separator />
        <SidebarPanel title="Scales">
          <VStack spacing={8}>
            {Object.values(palette.scales).map(scale => (
              <Link
                key={scale.id}
                to={`scale/${scale.id}`}
                style={{
                  color: 'inherit',
                  fontSize: 14,
                  textDecoration: 'none'
                }}
              >
                <VStack spacing={4}>
                  <span>{scale.name}</span>
                  <Box
                    sx={{
                      display: 'flex',
                      height: 24,
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}
                  >
                    {scale.colors.map((_, index) => {
                      const color = getColor(palette.curves, scale, index)
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
              </Link>
            ))}
          </VStack>
          <Button style={{marginTop: 16, width: '100%'}} onClick={() => send({type: 'CREATE_SCALE', paletteId})}>
            New scale
          </Button>
        </SidebarPanel>
        <Separator />
        <SidebarPanel title="Curves" action={<CurvesHelp />}>
          <VStack spacing={8}>
            {Object.values(palette.curves).map(curve => (
              <Link
                key={curve.id}
                to={`curve/${curve.id}`}
                style={{
                  color: 'inherit',
                  fontSize: 14,
                  textDecoration: 'none'
                }}
              >
                <VStack spacing={4}>
                  <span>{curve.name}</span>
                  <div
                    style={{
                      display: 'flex',
                      height: 24,
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}
                  >
                    {curve.values.map((value, index) => {
                      let color: Color

                      switch (curve.type) {
                        case 'hue':
                          color = {
                            hue: value,
                            saturation: 100,
                            lightness: 50
                          }
                          break

                        case 'saturation':
                          color = {
                            hue: 0,
                            saturation: 0,
                            lightness: 100 - value
                          }
                          break

                        case 'lightness':
                          color = {hue: 0, saturation: 0, lightness: value}
                          break
                      }

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
                  </div>
                </VStack>
              </Link>
            ))}
          </VStack>
        </SidebarPanel>
      </div>
      <Main>
        <Outlet context={{leftSidebarOpen, setLeftSidebarOpen}} />
      </Main>
    </Wrapper>
  )
}
