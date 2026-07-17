import {
  ChartSpline,
  Check,
  Lock,
  LockOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import {Box, Text} from '@primer/react'
import {Tooltip} from '@primer/react/drafts'
import {getContrast, getLuminance} from 'color2k'
import React from 'react'
import {useNavigate, useOutletContext, useParams} from 'react-router-dom'
import {Button, ButtonGroup, icon16, IconButton} from '../components/button'
import {Color} from '../components/color'
import {ContrastToggle} from '../components/contrast-toggle'
import {CurveEditor, CurveEditorHandle} from '../components/curve-editor'
import {CurveSelect} from '../components/curve-select'
import {Input} from '../components/input'
import {ProportionalEditingToggle} from '../components/proportional-editing-toggle'
import {Separator} from '../components/separator'
import {SidebarPanel} from '../components/sidebar-panel'
import {VStack, ZStack} from '../components/stack'
import {routePrefix} from '../constants'
import {useGlobalState} from '../global-state'
import {PaletteOutletContext} from './palette'
import {Channel} from '../types'
import {colorToHex, getColorName, getContrastScore, getNearestContrasting, getRange} from '../utils'

// The left list is rendered by the parent <Palette>, so this view reaches its
// links by id rather than by ref.
const SCALE_LINK_ID_PREFIX = 'scale-link-'

// The scale whose link currently has focus, or null if focus is elsewhere.
function focusedScaleId() {
  const element = document.activeElement
  if (!(element instanceof HTMLElement) || !element.id.startsWith(SCALE_LINK_ID_PREFIX)) return null
  return element.id.slice(SCALE_LINK_ID_PREFIX.length)
}

export function Scale() {
  const {paletteId = '', scaleId = ''} = useParams()
  const navigate = useNavigate()
  const [selectedIndex, setIndex] = React.useState('0')
  const [activeSeam, setActiveSeam] = React.useState<number | null>(null)
  // Which swatch is under the pointer, so the lock button can reveal itself
  // on hover. Driven from JS state rather than a CSS :hover selector because
  // Primer's IconButton wraps any sx we pass in a same-specificity
  // `&[data-size=...]` rule, which ties (and can lose) against an ancestor's
  // `:hover` selector.
  const [hoveredColorIndex, setHoveredColorIndex] = React.useState<number | null>(null)
  // Which color name is being edited inline (index), plus its draft text.
  const [editingName, setEditingName] = React.useState<number | null>(null)
  const [nameDraft, setNameDraft] = React.useState('')
  // Left panel lives in the parent <Palette>; its toggle and the active-panel
  // state are shared via Outlet context. The right panel is local to this view.
  const {leftSidebarOpen, setLeftSidebarOpen, contrastMode, setContrastMode, activePanel, setActivePanel} =
    useOutletContext<PaletteOutletContext>()
  const [rightSidebarOpen, setRightSidebarOpen] = React.useState(true)
  const [showContrastCurve, setShowContrastCurve] = React.useState(false)
  const [proportionalEditing, setProportionalEditing] = React.useState(false)
  const [proportionalRadius, setProportionalRadius] = React.useState(2)
  const [state, send] = useGlobalState()
  const palette = state.context.palettes[paletteId]
  const scale = palette.scales[scaleId]
  // TODO: allow resizing
  const [visibleCurves, setVisibleCurves] = React.useState({
    hue: true,
    saturation: true,
    lightness: true
  })

  // Which H/S/L curve is "active" for Tab/Shift+Tab and for re-focusing a point
  // in the center panel.
  const [activeCurveType, setActiveCurveType] = React.useState<Channel>('hue')
  // Which curve has a point in hand right now, so the other two can recede
  // behind it. Distinct from activeCurveType, which remembers the last curve
  // touched so Tab and the arrow keys have somewhere to land and therefore
  // always names one: this goes back to null the moment the point is let go.
  const [engagedCurveType, setEngagedCurveType] = React.useState<Channel | null>(null)
  // Which curve the inspector's Curve group is reporting on. Unlike
  // engagedCurveType it outlives the focus that set it, so reaching for the
  // group's own select — which blurs the point — doesn't unmount it mid-click.
  // Only taking hold of another curve moves it; null until one is touched.
  const [selectedCurveType, setSelectedCurveType] = React.useState<Channel | null>(null)
  const curveEditorRefs = React.useRef<Partial<Record<Channel, CurveEditorHandle | null>>>({})
  const nameInputRef = React.useRef<HTMLInputElement>(null)

  // Close any open name editor when navigating between scales.
  React.useEffect(() => {
    setEditingName(null)
  }, [scaleId])

  // [ / ] move the active panel (left <-> center <-> right, clamped, skipping
  // a closed panel). Shift+[ / Shift+] toggle the left/right panel instead.
  // While the center panel is active, Left/Right panel-switching keys are
  // physical-key-based (event.code) so Shift+[ still resolves correctly even
  // though Shift turns "[" into "{" on most layouts.
  React.useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === 'BracketLeft' || event.code === 'BracketRight') {
        if (isTypingTarget(event.target)) return
        event.preventDefault()

        if (event.shiftKey) {
          if (event.code === 'BracketLeft') {
            setLeftSidebarOpen(open => !open)
            setActivePanel(current => (current === 'left' ? 'center' : current))
          } else {
            setRightSidebarOpen(open => !open)
            setActivePanel(current => (current === 'right' ? 'center' : current))
          }
          return
        }

        const available = (['left', 'center', 'right'] as const).filter(
          panel => (panel !== 'left' || leftSidebarOpen) && (panel !== 'right' || rightSidebarOpen)
        )
        const direction = event.code === 'BracketRight' ? 1 : -1
        setActivePanel(current => {
          const currentIndex = current ? available.indexOf(current) : -1
          const nextIndex =
            currentIndex === -1 ? 0 : Math.max(0, Math.min(available.length - 1, currentIndex + direction))
          return available[nextIndex] ?? current
        })
        return
      }

      // Cyclic: wraps around at both ends. Shared by the left panel's plain
      // arrows and the Alt+Arrow scale switch below. `fromId` is the scale to
      // step from: the open one by default, but the focused one for the left
      // panel's arrows, since Tab can land on a scale other than the open one.
      function switchScale(direction: 1 | -1, fromId: string = scaleId) {
        const ids = Object.keys(palette.scales)
        if (ids.length === 0) return
        const currentIndex = ids.indexOf(fromId)
        const nextIndex =
          ((((currentIndex === -1 ? 0 : currentIndex) + direction) % ids.length) + ids.length) % ids.length
        const nextId = ids[nextIndex]
        if (nextId && nextId !== scaleId) {
          navigate(`${routePrefix}/local/${paletteId}/scale/${nextId}`)
        }
      }

      // Alt/Opt+Arrow switches scales from anywhere on the page, regardless of
      // which panel (if any) is active. It only refocuses a point afterwards
      // if one was already focused (activePanel === 'center'; see the
      // scaleId-change effect below) - it never selects one on its own.
      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        switchScale(event.key === 'ArrowDown' ? 1 : -1)
        return
      }

      // Keyed on focus rather than on activePanel === 'left' so the arrows work
      // however the list was reached (click, Tab, or [), and so they stay out of
      // the way of the left sidebar's other controls - the palette name input is
      // in the same panel but must keep its own arrow keys.
      const focusedId = focusedScaleId()
      if (focusedId && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        switchScale(event.key === 'ArrowDown' ? 1 : -1, focusedId)
        return
      }

      if (activePanel === 'center' && event.key === 'Tab') {
        event.preventDefault()
        const visibleTypes = (['hue', 'saturation', 'lightness'] as const).filter(type => visibleCurves[type])
        setActiveCurveType(current => {
          if (visibleTypes.length === 0) return current
          const currentIndex = visibleTypes.indexOf(current)
          const direction = event.shiftKey ? -1 : 1
          // Cyclic: switching curves wraps around at both ends (unlike panel
          // navigation, which clamps).
          const nextIndex =
            ((((currentIndex === -1 ? 0 : currentIndex) + direction) % visibleTypes.length) + visibleTypes.length) %
            visibleTypes.length
          return visibleTypes[nextIndex]
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activePanel,
    leftSidebarOpen,
    rightSidebarOpen,
    palette.scales,
    scaleId,
    paletteId,
    navigate,
    visibleCurves,
    setLeftSidebarOpen
  ])

  // Landing on a panel focuses its natural entry point: the current scale in
  // the left list, the last-selected point in the center curves, or the first
  // field on the right.
  React.useEffect(() => {
    if (!scale) return

    if (activePanel === 'left') {
      // Unless the list already has focus: clicking or tabbing to a scale is
      // what activates this panel in the first place, and focusing the current
      // scale here would yank focus off the one that was just reached.
      if (!focusedScaleId()) document.getElementById(`${SCALE_LINK_ID_PREFIX}${scaleId}`)?.focus()
    } else if (activePanel === 'center') {
      const visibleTypes = (['hue', 'saturation', 'lightness'] as const).filter(type => visibleCurves[type])
      const type = visibleTypes.includes(activeCurveType) ? activeCurveType : visibleTypes[0]
      const clampedIndex = Math.min(Number(selectedIndex), scale.colors.length - 1)
      if (type) curveEditorRefs.current[type]?.focusPoint(clampedIndex)
    } else if (activePanel === 'right') {
      nameInputRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel])

  // Switching scales (left panel arrows, or Alt+Arrow from anywhere) changes
  // scaleId; keep the equivalent thing focused in the new scale - the scale's
  // link on the left, or the same point index on the active curve. If neither
  // panel was active (e.g. Alt+Arrow pressed with no point selected), leave
  // focus/selection alone rather than selecting something new.
  React.useEffect(() => {
    // The new scale's curves haven't been touched yet. If focus lands on one
    // below, its onSelect will say so.
    setSelectedCurveType(null)

    if (activePanel === 'left') {
      document.getElementById(`scale-link-${scaleId}`)?.focus()
    } else if (activePanel === 'center' && scale) {
      const clampedIndex = Math.min(Number(selectedIndex), scale.colors.length - 1)
      curveEditorRefs.current[activeCurveType]?.focusPoint(clampedIndex)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleId])

  // Tab/Shift+Tab in the center panel changes activeCurveType; keep the same
  // point index focused on the newly active curve.
  React.useEffect(() => {
    if (activePanel !== 'center' || !scale) return
    const clampedIndex = Math.min(Number(selectedIndex), scale.colors.length - 1)
    curveEditorRefs.current[activeCurveType]?.focusPoint(clampedIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCurveType])

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
    const focusedColor = index ? scale.colors[parseInt(index, 10)] : undefined
    focusedHex = focusedColor ? colorToHex(focusedColor) : undefined
  } catch (error) {}

  // What each swatch's contrast score is measured against: either the selected
  // color in this scale (relative), or the palette background. The stripe draws
  // this color as ink so the number and the preview stay in sync.
  const contrastReference = contrastMode === 'background' ? palette.backgroundColor : focusedHex
  const scaleHexes = scale.colors.map(colorToHex)
  // Per-swatch contrast against contrastReference, plotted as a read-only curve
  // (see the contrast curve toggle button) so the shape of the contrast change across
  // the scale is visible alongside the H/S/L curves.
  const contrastCurveValues = scaleHexes.map(hex => (contrastReference ? getContrast(hex, contrastReference) : 1))
  // The darkest color in the scale, used as the label halo / failing mark so it
  // reads on the (typically light) swatches where contrast fails, while staying
  // drawn from the scale's own colors.
  const shadowColor = scaleHexes.reduce((darkest, hex) => (getLuminance(hex) < getLuminance(darkest) ? hex : darkest))
  // Locked colors can still have their curve points selected, but not moved.
  const lockedIndices = scale.colors.map(color => Boolean(color.locked))
  // A radius long enough to span the scale reaches every point from either end,
  // so cap it there. Clamped on read rather than on change: deleting colors from
  // a scale would otherwise trim a radius that its other scales still have room
  // for, and the setting is shared across them.
  const maxProportionalRadius = Math.max(1, scale.colors.length - 1)
  const effectiveProportionalRadius = proportionalEditing ? Math.min(proportionalRadius, maxProportionalRadius) : 0

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
          // Extra left padding reserves a gutter for the H/S/L curve labels and
          // the curve icon that sits further out on a driven channel, both of
          // which overflow to the left of the swatches (see curve-editor.tsx).
          padding: '16px 16px 16px 48px',
          height: '100%'
        }}
      >
        <Box sx={{flexShrink: 0, display: 'flex', justifyContent: 'space-between'}}>
          <Box sx={{display: 'flex', gap: 2}}>
            {/* The panel buttons show their state through the icon and label
                rather than a pressed fill, so they carry no aria-pressed - that
                would tint them like the toggles below. */}
            <Tooltip text={leftSidebarOpen ? 'Hide Scales' : 'Show Scales'} direction="s">
              <IconButton
                aria-label={leftSidebarOpen ? 'Hide Scales' : 'Show Scales'}
                icon={icon16(leftSidebarOpen ? PanelLeftClose : PanelLeftOpen)}
                onClick={() => setLeftSidebarOpen(open => !open)}
              />
            </Tooltip>
            <ButtonGroup>
              {Object.entries(visibleCurves).map(([type, isVisible]) => {
                const label = `${isVisible ? 'Hide' : 'Show'} ${type} curve`
                return (
                  <Tooltip key={type} text={label} direction="s">
                    <Button
                      aria-label={label}
                      aria-pressed={isVisible}
                      onClick={() => setVisibleCurves({...visibleCurves, [type]: !isVisible})}
                    >
                      {type[0].toUpperCase()}
                    </Button>
                  </Tooltip>
                )
              })}
            </ButtonGroup>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, ml: 2}}>
              <Text sx={{fontSize: 1, color: 'fg.muted'}}>Contrast:</Text>
              <ContrastToggle value={contrastMode} onChange={setContrastMode} />
            </Box>
            <Tooltip text={showContrastCurve ? 'Hide contrast curve' : 'Show contrast curve'} direction="s">
              <IconButton
                aria-label={showContrastCurve ? 'Hide contrast curve' : 'Show contrast curve'}
                aria-pressed={showContrastCurve}
                icon={icon16(ChartSpline)}
                onClick={() => setShowContrastCurve(show => !show)}
              />
            </Tooltip>
            <ProportionalEditingToggle
              enabled={proportionalEditing}
              onEnabledChange={setProportionalEditing}
              radius={Math.min(proportionalRadius, maxProportionalRadius)}
              onRadiusChange={setProportionalRadius}
              max={maxProportionalRadius}
            />
          </Box>
          <Tooltip text={rightSidebarOpen ? 'Hide Inspector' : 'Show Inspector'} direction="sw">
            <IconButton
              aria-label={rightSidebarOpen ? 'Hide Inspector' : 'Show Inspector'}
              icon={icon16(rightSidebarOpen ? PanelRightClose : PanelRightOpen)}
              onClick={() => setRightSidebarOpen(open => !open)}
            />
          </Tooltip>
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
          onFocusCapture={() => setActivePanel('center')}
        >
          <Box
            sx={{
              display: 'flex',
              width: '100%',
              height: '100%',
              borderRadius: 2
            }}
          >
            {scale.colors.map((color, i) => {
              const hex = colorToHex(color)
              const contrast = contrastReference ? getContrast(hex, contrastReference) : undefined
              const contrastScore = contrast ? getContrastScore(contrast) : undefined
              const isLocked = Boolean(scale.colors[i].locked)
              return (
                <Box
                  key={i}
                  tabIndex={0}
                  onFocus={() => setIndex(String(i))}
                  onMouseEnter={() => setHoveredColorIndex(i)}
                  onMouseLeave={() => setHoveredColorIndex(current => (current === i ? null : current))}
                  sx={{
                    outline: 'none',
                    width: '100%',
                    height: '100%',
                    color: contrastReference,
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
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '2px',
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
                    {/* A plain unstyled button (not Primer's IconButton) so its
                        size is fully under our control and it fits inside this
                        row without growing past it into the selection bar
                        below - if it did, the swatch would swallow clicks
                        meant for the button. */}
                    <Box
                      as="button"
                      type="button"
                      aria-label={
                        isLocked ? `Unlock ${getColorName(scale.colors, i)}` : `Lock ${getColorName(scale.colors, i)}`
                      }
                      aria-pressed={isLocked}
                      onClick={event => {
                        event.stopPropagation()
                        send({type: 'TOGGLE_COLOR_LOCK', paletteId, scaleId, index: i})
                      }}
                      sx={{
                        all: 'unset',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        width: 16,
                        height: 16,
                        borderRadius: 2,
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                        opacity: isLocked || hoveredColorIndex === i ? 1 : 0,
                        transition: 'opacity 120ms ease',
                        '@media (prefers-reduced-motion: reduce)': {transition: 'none'},
                        '&:hover': {backgroundColor: 'var(--color-background-secondary)'},
                        '&:focus-visible': {
                          opacity: 1,
                          outline: '2px solid var(--color-accent-emphasis, #0969da)',
                          outlineOffset: '1px'
                        }
                      }}
                    >
                      {isLocked ? <Lock size={12} /> : <LockOpen size={12} />}
                    </Box>
                  </Box>
                  <Box
                    display="flex"
                    alignItems="center"
                    flexDirection="column"
                    sx={{
                      gap: 1,
                      lineHeight: 1,
                      // Only failing labels risk being illegible against their
                      // swatch, so only they get the readable halo.
                      textShadow:
                        contrastScore === 'Fail' ? `0 0 1px ${shadowColor}, 0 0 2px ${shadowColor}` : undefined
                    }}
                  >
                    <span style={{fontWeight: 'normal'}}>{contrast ? contrast.toFixed(2) : ''}</span>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                      {/* The mark previews the measured pairing: the disc is the
                          ink color (like the label text) with the swatch color
                          punched through. A failing mark would vanish into the
                          disc (that low contrast is the failure), so it switches
                          to the nearest scale color that reads on the disc. */}
                      <Box
                        sx={{
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: contrastReference
                        }}
                      >
                        {contrastScore === 'Fail' ? (
                          <X
                            size={11}
                            strokeWidth={4}
                            color={getNearestContrasting(scaleHexes, i, contrastReference || hex)}
                          />
                        ) : (
                          <Check size={11} strokeWidth={4} color={hex} />
                        )}
                      </Box>
                      <span>{contrastScore}</span>
                    </Box>
                  </Box>
                </Box>
              )
            })}
          </Box>
          {showContrastCurve ? (
            <CurveEditor key="contrast-curve" values={contrastCurveValues} min={1} max={21} disabled label="C" />
          ) : null}
          {(['hue', 'saturation', 'lightness'] as const)
            .filter(type => visibleCurves[type])
            .map(type => {
              const driven = Boolean(scale.curves?.[type])

              return (
                <CurveEditor
                  key={type}
                  ref={handle => (curveEditorRefs.current[type] = handle)}
                  values={scale.colors.map(color => color[type])}
                  {...getRange(type)}
                  lockedIndices={lockedIndices}
                  driven={driven}
                  // A preset already decides every point between the ends, so
                  // there is nothing for a falloff to hand movement to.
                  proportionalRadius={driven ? 0 : effectiveProportionalRadius}
                  dimmed={engagedCurveType !== null && engagedCurveType !== type}
                  label={`${type[0].toUpperCase()}`}
                  onFocus={index => {
                    setIndex(String(index))
                    setActiveCurveType(type)
                    setEngagedCurveType(type)
                  }}
                  onSelect={() => setSelectedCurveType(type)}
                  onBlur={() => setEngagedCurveType(current => (current === type ? null : current))}
                  onChange={values => {
                    send({
                      type: 'CHANGE_SCALE_COLORS',
                      paletteId,
                      scaleId,
                      colors: scale.colors.map((color, index) => ({
                        ...color,
                        [type]: values[index]
                      }))
                    })
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
        onFocusCapture={() => setActivePanel('right')}
      >
        <SidebarPanel
          title="Scale"
          action={
            <IconButton
              $transparent
              aria-label="Delete scale"
              icon={icon16(Trash2)}
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
                ref={nameInputRef}
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
        {selectedCurveType ? (
          <>
            <Separator />
            <CurveSelect
              channel={selectedCurveType}
              curve={scale.curves?.[selectedCurveType]}
              sampleColors={scaleHexes}
              onChange={curve =>
                send({
                  type: 'CHANGE_SCALE_CURVE',
                  paletteId,
                  scaleId,
                  channel: selectedCurveType,
                  curve
                })
              }
            />
          </>
        ) : null}
        {index ? (
          <>
            <Separator />
            <Color paletteId={paletteId} scaleId={scaleId} index={index} />
          </>
        ) : null}
      </VStack>
    </div>
  )
}
