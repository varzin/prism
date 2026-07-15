import {
  CheckCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Trash2,
  XCircle
} from 'lucide-react'
import {Box, ButtonGroup, Text} from '@primer/react'
import {getContrast} from 'color2k'
import React from 'react'
import {Link, useNavigate, useOutletContext, useParams} from 'react-router-dom'
import {Button, IconButton} from '../components/button'
import {Color} from '../components/color'
import {CurveEditor} from '../components/curve-editor'
import {Input} from '../components/input'
import {Select} from '../components/select'
import {Separator} from '../components/separator'
import {SidebarPanel} from '../components/sidebar-panel'
import {VStack, ZStack} from '../components/stack'
import {routePrefix} from '../constants'
import {useGlobalState} from '../global-state'
import {PaletteOutletContext} from './palette'
import {Curve} from '../types'
import {colorToHex, getColor, getColorName, getContrastScore, getRange} from '../utils'

export function Scale() {
  const {paletteId = '', scaleId = ''} = useParams()
  const navigate = useNavigate()
  const [selectedIndex, setIndex] = React.useState('0')
  const [activeSeam, setActiveSeam] = React.useState<number | null>(null)
  // Which color name is being edited inline (index), plus its draft text.
  const [editingName, setEditingName] = React.useState<number | null>(null)
  const [nameDraft, setNameDraft] = React.useState('')
  // Left panel lives in the parent <Palette>; its toggle is shared via Outlet
  // context. The right panel is local to this view.
  const {leftSidebarOpen, setLeftSidebarOpen} = useOutletContext<PaletteOutletContext>()
  const [rightSidebarOpen, setRightSidebarOpen] = React.useState(true)
  const [state, send] = useGlobalState()
  const palette = state.context.palettes[paletteId]
  const scale = palette.scales[scaleId]
  // TODO: allow resizing
  const [visibleCurves, setVisibleCurves] = React.useState({
    hue: true,
    saturation: true,
    lightness: true
  })

  // Close any open name editor when navigating between scales.
  React.useEffect(() => {
    setEditingName(null)
  }, [scaleId])

  if (!scale) {
    return (
      <div style={{padding: 16}}>
        <p style={{marginTop: 0}}>Scale not found</p>
      </div>
    )
  }

  let focusedHex: string | undefined
  const index = String(Math.min(Number(selectedIndex), scale.colors.length - 1))

  try {
    const focusedColor = index ? getColor(palette.curves, scale, parseInt(index, 10)) : undefined
    focusedHex = focusedColor ? colorToHex(focusedColor) : undefined
  } catch (error) {}

  return (
    <div
      style={{
        display: 'flex',
        height: '100%'
      }}
    >
      <div
        style={{
          flexGrow: 1,
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr',
          gap: 16,
          // Extra left padding reserves a gutter for the H/S/L curve labels,
          // which overflow to the left of the swatches (see curve-editor.tsx).
          padding: '16px 16px 16px 28px',
          height: '100%'
        }}
      >
        <Box sx={{flexShrink: 0, display: 'flex', justifyContent: 'space-between'}}>
          <Box sx={{display: 'flex', gap: 2}}>
            <IconButton
              aria-label={leftSidebarOpen ? 'Hide left panel' : 'Show left panel'}
              aria-pressed={leftSidebarOpen}
              icon={() => (leftSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />)}
              onClick={() => setLeftSidebarOpen(open => !open)}
            />
            <ButtonGroup>
              {Object.entries(visibleCurves).map(([type, isVisible]) => {
                return (
                  <Button
                    key={type}
                    aria-label={`Toggle ${type} curve visibility`}
                    aria-pressed={isVisible}
                    onClick={() => setVisibleCurves({...visibleCurves, [type]: !isVisible})}
                    style={{
                      background: isVisible ? 'var(--color-background-secondary)' : 'var(--color-background)'
                    }}
                  >
                    {type[0].toUpperCase()}
                  </Button>
                )
              })}
            </ButtonGroup>
          </Box>
          <IconButton
            aria-label={rightSidebarOpen ? 'Hide right panel' : 'Show right panel'}
            aria-pressed={rightSidebarOpen}
            icon={() => (rightSidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />)}
            onClick={() => setRightSidebarOpen(open => !open)}
          />
        </Box>
        <div style={{height: 8}}></div>
        <ZStack
          // Reveal the seam "+" by proximity instead of a permanent pointer-
          // capturing strip, so clicks on swatches and drags on curve handles
          // are never swallowed near a boundary. Skip while a mouse button is
          // held (e.g. dragging a curve) so the affordance doesn't flash.
          onMouseMove={event => {
            if (event.buttons !== 0) return
            const count = scale.colors.length
            const rect = event.currentTarget.getBoundingClientRect()
            if (!rect.width || !count) return
            const x = event.clientX - rect.left
            const seam = Math.max(0, Math.min(count, Math.round((x / rect.width) * count)))
            const seamX = (seam / count) * rect.width
            setActiveSeam(Math.abs(x - seamX) <= 16 ? seam : null)
          }}
          onMouseLeave={() => setActiveSeam(null)}
        >
          <Box
            sx={{
              display: 'flex',
              width: '100%',
              height: '100%',
              borderRadius: 2
            }}
          >
            {scale.colors.map((_, i) => {
              const color = getColor(palette.curves, scale, i)
              const hex = colorToHex(color)
              const contrast = focusedHex ? getContrast(hex, focusedHex) : undefined
              const contrastScore = contrast ? getContrastScore(contrast) : undefined
              return (
                <Box
                  key={i}
                  tabIndex={0}
                  onFocus={() => setIndex(String(i))}
                  sx={{
                    outline: 'none',
                    width: '100%',
                    height: '100%',
                    color: focusedHex,
                    backgroundColor: hex,
                    borderTopLeftRadius: i === 0 ? 2 : 0,
                    borderBottomLeftRadius: i === 0 ? 2 : 0,
                    borderTopRightRadius: i === scale.colors.length - 1 ? 2 : 0,
                    borderBottomRightRadius: i === scale.colors.length - 1 ? 2 : 0,
                    position: 'relative',
                    fontSize: 1,
                    display: 'grid',
                    placeItems: 'end center',
                    p: 2,
                    fontWeight: 'bold',
                    '&::before': {
                      content: '""',
                      display: Number(index) === i ? 'block' : 'none',
                      position: 'absolute',
                      top: '-8px',
                      height: Number(index) === i ? 4 : '21px',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--color-text)',
                      borderRadius: 2
                    }
                  }}
                  onClick={() => setIndex(String(i))}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '-26px',
                      left: 0,
                      right: 0,
                      display: 'grid',
                      placeItems: 'center',
                      // Clicking anywhere in the strip except the text just selects
                      // the color (the click bubbles to the swatch's onClick).
                      cursor: 'pointer',
                      // Sit above the curve/seam overlays so the label is clickable.
                      zIndex: 1
                    }}
                  >
                    {editingName === i ? (
                      <input
                        autoFocus
                        aria-label={`Name for ${scale.name}.${i}`}
                        value={nameDraft}
                        onChange={event => setNameDraft(event.target.value)}
                        onClick={event => event.stopPropagation()}
                        onBlur={() => {
                          const trimmed = nameDraft.trim()
                          if (trimmed) send({type: 'CHANGE_COLOR_NAME', paletteId, scaleId, index: i, name: trimmed})
                          setEditingName(null)
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur()
                          } else if (event.key === 'Escape') {
                            setEditingName(null)
                          }
                        }}
                        style={{
                          width: 48,
                          textAlign: 'center',
                          fontSize: 12,
                          fontFamily: 'inherit',
                          fontWeight: 'bold',
                          border: '1px solid var(--color-accent-emphasis, #0969da)',
                          borderRadius: 6,
                          padding: '1px 4px',
                          background: 'var(--color-background, #fff)',
                          color: 'var(--color-text)',
                          outline: 'none'
                        }}
                      />
                    ) : (
                      <Box
                        as="button"
                        type="button"
                        aria-label={`Edit name for ${scale.name}.${i}`}
                        onClick={event => {
                          event.stopPropagation()
                          setIndex(String(i))
                          setNameDraft(getColorName(scale.colors, i))
                          setEditingName(i)
                        }}
                        sx={{
                          all: 'unset',
                          // Only the text itself starts editing; it shows a text
                          // caret and highlights on hover to signal it's editable.
                          cursor: 'text',
                          fontSize: 0,
                          lineHeight: 1.5,
                          px: 1,
                          borderRadius: 2,
                          color: 'var(--color-text)',
                          fontWeight: Number(index) === i ? 'bold' : 'normal',
                          '&:hover': {backgroundColor: 'var(--color-background-secondary)'},
                          '&:focus-visible': {
                            outline: '2px solid var(--color-accent-emphasis, #0969da)',
                            outlineOffset: '1px'
                          }
                        }}
                      >
                        {getColorName(scale.colors, i)}
                      </Box>
                    )}
                  </Box>
                  <Box display="flex" alignItems="center" flexDirection="column">
                    <span
                      style={{
                        transform: 'rotate(180deg)',
                        textOrientation: 'sideways',
                        writingMode: 'vertical-lr',
                        whiteSpace: 'nowrap',
                        textAlign: 'right',
                        marginInlineEnd: 5,
                        lineHeight: 1
                      }}
                    >
                      {contrastScore}{' '}
                    </span>
                    {contrastScore === 'Fail' ? <XCircle size={16} /> : <CheckCircle size={16} />}
                  </Box>
                </Box>
              )
            })}
          </Box>
          {(Object.entries(scale.curves) as [Curve['type'], string | undefined][])
            .filter(([type]) => visibleCurves[type])
            .map(([type, curveId]) => {
              if (!curveId) return null

              return (
                <CurveEditor
                  key={curveId}
                  values={palette.curves[curveId].values}
                  {...getRange(type)}
                  disabled
                  label={`${type[0].toUpperCase()}`}
                />
              )
            })}
          {(['hue', 'saturation', 'lightness'] as const)
            .filter(type => visibleCurves[type])
            .map(type => {
              return (
                <CurveEditor
                  key={type}
                  values={scale.colors.map((color, index) => getColor(palette.curves, scale, index)[type])}
                  {...getRange(type)}
                  label={`${type[0].toUpperCase()}`}
                  onFocus={index => setIndex(String(index))}
                  onChange={(values, shiftKey, index) => {
                    if (shiftKey && scale.curves[type]) {
                      send({
                        type: 'CHANGE_CURVE_VALUES',
                        paletteId,
                        curveId: scale.curves[type] ?? '',
                        values: values.map((value, index) => value - scale.colors[index][type])
                      })
                    } else {
                      send({
                        type: 'CHANGE_SCALE_COLORS',
                        paletteId,
                        scaleId,
                        colors: scale.colors.map((color, index) => ({
                          ...color,
                          [type]: values[index] - (palette.curves[scale.curves[type] ?? '']?.values[index] ?? 0)
                        }))
                      })
                    }
                  }}
                />
              )
            })}
          {/*
            Seam insert affordances. Rendered last so they paint above the curve
            editors, yet with no positive z-index a modal's fixed backdrop still
            covers them. The whole overlay ignores pointer events; only a
            revealed "+" button (see ZStack onMouseMove) captures clicks, so
            swatch selection and curve editing are never blocked near a seam.
          */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          >
            {Array.from({length: scale.colors.length + 1}).map((_, seamIndex) => {
              const count = scale.colors.length
              const isStart = seamIndex === 0
              const isEnd = seamIndex === count
              const active = activeSeam === seamIndex
              const label = isStart
                ? 'Add color to start of scale'
                : isEnd
                ? 'Add color to end of scale'
                : `Insert color between ${seamIndex - 1} and ${seamIndex}`
              return (
                <Box
                  key={seamIndex}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${(seamIndex / count) * 100}%`,
                    width: 32,
                    // Center on the seam — including the two edges, so the start
                    // and end affordances straddle the border and stick out.
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    display: 'grid',
                    placeItems: 'center',
                    // Hairline guide that snaps to the seam, echoing the curve
                    // editor's visual language.
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: '50%',
                      width: '2px',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'var(--color-text)',
                      opacity: active ? 0.25 : 0,
                      transition: 'opacity 120ms ease',
                      '@media (prefers-reduced-motion: reduce)': {transition: 'none'}
                    }
                  }}
                >
                  <Box
                    as="button"
                    type="button"
                    aria-label={label}
                    onFocus={() => setActiveSeam(seamIndex)}
                    onBlur={() => setActiveSeam(current => (current === seamIndex ? null : current))}
                    onClick={event => {
                      send({type: 'INSERT_COLOR', paletteId, scaleId, index: seamIndex})
                      setIndex(String(seamIndex))
                      // Mouse (detail > 0): hide until the pointer nears a seam
                      // again, and drop focus. Keyboard (detail === 0): keep the
                      // button focused and visible so focus isn't lost to body.
                      if (event.detail !== 0) {
                        setActiveSeam(null)
                        event.currentTarget.blur()
                      }
                    }}
                    sx={{
                      all: 'unset',
                      boxSizing: 'border-box',
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-background, #fff)',
                      border: '1px solid',
                      borderColor: active
                        ? 'var(--color-accent-emphasis, #0969da)'
                        : 'var(--color-border, rgba(0,0,0,0.2))',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.24)',
                      color: 'var(--color-text)',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      opacity: active ? 1 : 0,
                      transform: active ? 'scale(1)' : 'scale(0.7)',
                      // Only interactive once revealed, so a hidden node never
                      // swallows a click meant for the swatch behind it.
                      pointerEvents: active ? 'auto' : 'none',
                      transition: 'opacity 120ms ease, transform 120ms ease',
                      '@media (prefers-reduced-motion: reduce)': {transition: 'none'},
                      '&:focus-visible': {
                        outline: '2px solid var(--color-accent-emphasis, #0969da)',
                        outlineOffset: '2px'
                      }
                    }}
                  >
                    <Plus size={14} />
                  </Box>
                </Box>
              )
            })}
          </Box>
        </ZStack>
        {index ? (
          <div style={{flexShrink: 0, display: 'flex', height: 48}}>
            {Object.values(palette.scales)
              .filter(scale => scale.colors.length > parseInt(index))
              .map((currentScale, i) => {
                const numScales = Object.values(palette.scales).filter(
                  scale => scale.colors.length > parseInt(index)
                ).length
                return (
                  <Box
                    key={i}
                    as={Link}
                    aria-label={`Go to ${currentScale.name} scale`}
                    to={`${routePrefix}/local/${paletteId}/scale/${currentScale.id}`}
                    replace={true}
                    sx={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: colorToHex(getColor(palette.curves, currentScale, parseInt(index))),
                      borderTopLeftRadius: i === 0 ? 2 : 0,
                      borderBottomLeftRadius: i === 0 ? 2 : 0,
                      borderTopRightRadius: i === numScales - 1 ? 2 : 0,
                      borderBottomRightRadius: i === numScales - 1 ? 2 : 0,
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        display: scale.id === currentScale.id ? 'block' : 'none',
                        position: 'absolute',
                        top: '-8px',
                        height: 4,
                        left: 0,
                        right: 0,
                        backgroundColor: 'var(--color-text)',
                        borderRadius: 2
                      }
                    }}
                  />
                )
              })}
          </div>
        ) : null}
      </div>
      <VStack
        style={{
          display: rightSidebarOpen ? 'grid' : 'none',
          borderLeft: '1px solid var(--color-border, gainsboro)',
          width: 300,
          flexShrink: 0,
          overflow: 'auto',
          paddingBottom: 16
        }}
      >
        <SidebarPanel
          title="Scale"
          action={
            <IconButton
              $transparent
              aria-label="Delete scale"
              icon={() => <Trash2 size={16} />}
              onClick={() => {
                send({type: 'DELETE_SCALE', paletteId, scaleId})
                navigate(`${routePrefix}/local/${paletteId}`)
              }}
            />
          }
        >
          <VStack spacing={16}>
            <VStack spacing={4}>
              <label htmlFor="name" style={{fontSize: 14}}>
                Name
              </label>
              <Input
                type="text"
                aria-label="Scale name"
                value={scale.name}
                onChange={event =>
                  send({
                    type: 'CHANGE_SCALE_NAME',
                    paletteId,
                    scaleId,
                    name: event.target.value
                  })
                }
              />
            </VStack>
          </VStack>
        </SidebarPanel>
        <Separator />
        <SidebarPanel title="Linked curves">
          <VStack spacing={16}>
            <VStack spacing={4}>
              <label htmlFor="hue-curve" style={{fontSize: 14}}>
                Hue curve
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8
                }}
              >
                <Select
                  key={`${scale.name}-hue-curve`}
                  id="hue-curve"
                  value={scale.curves.hue}
                  onChange={event =>
                    send({
                      type: 'CHANGE_SCALE_CURVE',
                      paletteId,
                      scaleId,
                      curveType: 'hue',
                      curveId: event.target.value
                    })
                  }
                >
                  <option value="">None</option>
                  {Object.values(palette.curves)
                    .filter(curve => curve.type === 'hue')
                    .map(curve => (
                      <option key={curve.id} value={curve.id}>
                        {curve.name}
                      </option>
                    ))}
                </Select>
                <IconButton
                  aria-label="Create hue curve"
                  icon={() => <Plus size={16} />}
                  onClick={() =>
                    send({
                      type: 'CREATE_CURVE_FROM_SCALE',
                      paletteId,
                      scaleId,
                      curveType: 'hue'
                    })
                  }
                />
              </div>
            </VStack>
            <VStack spacing={4}>
              <label htmlFor="saturation-curve" style={{fontSize: 14}}>
                Saturation curve
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8
                }}
              >
                <Select
                  key={`${scale.name}-saturation-curve`}
                  id="saturation-curve"
                  value={scale.curves.saturation}
                  onChange={event =>
                    send({
                      type: 'CHANGE_SCALE_CURVE',
                      paletteId,
                      scaleId,
                      curveType: 'saturation',
                      curveId: event.target.value
                    })
                  }
                >
                  <option value="">None</option>
                  {Object.values(palette.curves)
                    .filter(curve => curve.type === 'saturation')
                    .map(curve => (
                      <option key={curve.id} value={curve.id}>
                        {curve.name}
                      </option>
                    ))}
                </Select>
                <IconButton
                  icon={() => <Plus size={16} />}
                  aria-label="Create saturation curve"
                  onClick={() =>
                    send({
                      type: 'CREATE_CURVE_FROM_SCALE',
                      paletteId,
                      scaleId,
                      curveType: 'saturation'
                    })
                  }
                />
              </div>
            </VStack>
            <VStack spacing={4}>
              <label htmlFor="lightness-curve" style={{fontSize: 14}}>
                Lightness curve
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8
                }}
              >
                <Select
                  key={`${scale.name}-lightness-curve`}
                  id="lightness-curve"
                  value={scale.curves.lightness}
                  onChange={event =>
                    send({
                      type: 'CHANGE_SCALE_CURVE',
                      paletteId,
                      scaleId,
                      curveType: 'lightness',
                      curveId: event.target.value
                    })
                  }
                >
                  <option value="">None</option>
                  {Object.values(palette.curves)
                    .filter(curve => curve.type === 'lightness')
                    .map(curve => (
                      <option key={curve.id} value={curve.id}>
                        {curve.name}
                      </option>
                    ))}
                </Select>
                <IconButton
                  aria-label="Create lightness curve"
                  icon={() => <Plus size={16} />}
                  onClick={() =>
                    send({
                      type: 'CREATE_CURVE_FROM_SCALE',
                      paletteId,
                      scaleId,
                      curveType: 'lightness'
                    })
                  }
                />
              </div>
            </VStack>
          </VStack>
        </SidebarPanel>
        {index ? (
          <>
            <Separator />
            <Color paletteId={paletteId} scaleId={scaleId} index={index} />
            <Separator />
            {/* TODO: Pull this into a separate component */}
            <SidebarPanel title={`Contrast of ${scale.name}.${getColorName(scale.colors, Number(index))}`}>
              <Box
                as="ul"
                sx={{
                  m: 0,
                  p: 0,
                  listStyle: 'none',
                  display: 'grid',
                  gap: 2,
                  fontSize: 1
                }}
              >
                {[
                  {
                    name: 'bg',
                    hex: palette.backgroundColor,
                    contrast: getContrast(palette.backgroundColor, focusedHex || '')
                  },
                  ...scale.colors
                    .map((_, i) => {
                      const hex = colorToHex(getColor(palette.curves, scale, i))
                      const contrast = getContrast(hex, focusedHex || '')
                      return {
                        name: `${scale.name}.${getColorName(scale.colors, i)}`,
                        hex,
                        contrast
                      }
                    })
                    .filter((_, i) => i !== Number(index))
                ].map(({name, hex, contrast}) => (
                  <Box
                    key={name}
                    as="li"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                      <Box
                        aria-hidden
                        sx={{
                          color: focusedHex,
                          bg: hex,
                          border: '1px solid',
                          borderColor: 'var(--color-border)',
                          width: 32,
                          height: 32,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 2
                        }}
                      >
                        Aa
                      </Box>
                      <span>on {name}</span>
                    </Box>
                    <span>
                      <Text sx={{mr: 2}}>{contrast.toFixed(2)}</Text>
                      <Text sx={{fontWeight: 'bold'}}>
                        {getContrastScore(getContrast(hex, focusedHex || ''))}{' '}
                        {getContrastScore(getContrast(hex, focusedHex || '')) === 'Fail' ? (
                          <XCircle size={16} />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                      </Text>
                    </span>
                  </Box>
                ))}
              </Box>
            </SidebarPanel>
          </>
        ) : null}
      </VStack>
    </div>
  )
}
