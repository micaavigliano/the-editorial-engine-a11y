import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { createOrb, moveOrbs, pauseAllOrbs } from './orbs'
import { renderOrbs } from './renderer'
import { Header } from './components/Header'
import { Main } from './components/Main'
import { Footer } from './components/Footer'
import type { Orb, OrbDef, Stats } from './types'

const HEADLINE_TEXT = 'Text animations and accessibility'
const BOTTOM_RESERVE_FALLBACK = 94
const MOVE_STEP = 20

const ORB_DEFS: OrbDef[] = [
  { fx: 0.52, fy: 0.22, r: 110, vx: 24, vy: 16, color: [196, 163, 90], label: 'Golden orb' },
  { fx: 0.18, fy: 0.48, r: 85, vx: -19, vy: 26, color: [100, 140, 255], label: 'Blue orb' },
  { fx: 0.74, fy: 0.58, r: 95, vx: 16, vy: -21, color: [232, 100, 130], label: 'Pink orb' },
  { fx: 0.38, fy: 0.72, r: 75, vx: -26, vy: -14, color: [80, 200, 140], label: 'Green orb' },
  { fx: 0.86, fy: 0.18, r: 65, vx: -13, vy: 19, color: [150, 100, 220], label: 'Violet orb' },
]

export default function App() {
  const headerRef = useRef<HTMLElement>(null)
  const footerRef = useRef<HTMLElement>(null)
  const orbElsRef = useRef<(HTMLButtonElement | null)[]>([])
  const orbsRef = useRef<Orb[]>([])
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const activeOrbRef = useRef<Orb | null>(null)
  const fpsTimestamps = useRef<number[]>([])

  const [isPaused, setIsPaused] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const [respectMotionPref, setRespectMotionPref] = useState(true)
  const skipAnimation = respectMotionPref && reducedMotion
  const [liveMessage, setLiveMessage] = useState('')
  const [stats, setStats] = useState<Stats>({ lines: 0, reflow: '0.0', fps: 60, cols: 0 })
  const [orbsHidden, setOrbsHidden] = useState(false)
  const orbsHiddenRef = useRef(false)

  useEffect(() => {
    const checkZoom = () => {
      const zoom = window.outerWidth / window.innerWidth
      const hidden = zoom >= 1.5 || window.innerWidth < 500
      orbsHiddenRef.current = hidden
      setOrbsHidden(hidden)
    }
    checkZoom()
    window.addEventListener('resize', checkZoom)
    return () => window.removeEventListener('resize', checkZoom)
  }, [])

  useEffect(() => {
    const { innerWidth, innerHeight } = window
    orbsRef.current = ORB_DEFS.map((d) => createOrb(d, innerWidth, innerHeight))
  }, [])

  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const update = () => {
      document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])

  const renderFrame = (now: number, isStatic: boolean) => {
    const dt = isStatic ? 0 : Math.min((now - lastTimeRef.current) / 1000, 0.05)
    lastTimeRef.current = now

    const { clientWidth: pw, clientHeight: ph } = document.documentElement
    const { scrollY } = window

    const hideOrbs = orbsHiddenRef.current
    if (!isStatic && !hideOrbs) moveOrbs(orbsRef.current, dt, pw, ph)
    if (!hideOrbs) renderOrbs(orbsRef.current, orbElsRef.current, scrollY)

    if (!isStatic) {
      fpsTimestamps.current.push(now)
      fpsTimestamps.current = fpsTimestamps.current.filter((t) => t >= now - 1000)
    }

    setStats({ lines: 0, reflow: '0.0', fps: isStatic ? 0 : fpsTimestamps.current.length, cols: 0 })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setIsPaused((p) => {
        const next = !p
        pauseAllOrbs(orbsRef.current, next, window.scrollY)
        setLiveMessage(next ? 'All orbs paused' : 'All orbs resumed')
        return next
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (skipAnimation) { renderFrame(performance.now(), true); return }
    const animate = (now: number) => { renderFrame(now, false); rafRef.current = requestAnimationFrame(animate) }
    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipAnimation])

  const toggleOrbPause = (orb: Orb) => {
    orb.paused = !orb.paused
    if (orb.paused) orb.frozenScrollY = window.scrollY
    setLiveMessage(`${orb.label}: ${orb.paused ? 'paused' : 'moving'}`)
    if (orbsRef.current.every((o) => o.paused)) setIsPaused(true)
    else if (orbsRef.current.every((o) => !o.paused)) setIsPaused(false)
  }

  const handleOrbPointerDown = (e: React.PointerEvent, i: number) => {
    const orb = orbsRef.current[i]
    if (!orb) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    activeOrbRef.current = orb
    Object.assign(orb, { dragging: true, dragStartX: e.clientX, dragStartY: e.clientY, dragStartOrbX: orb.x, dragStartOrbY: orb.y })
  }

  const handleOrbPointerMove = (e: React.PointerEvent) => {
    const orb = activeOrbRef.current
    if (!orb) return
    orb.x = orb.dragStartOrbX + (e.clientX - orb.dragStartX)
    orb.y = orb.dragStartOrbY + (e.clientY - orb.dragStartY)
  }

  const handleOrbPointerUp = (e: React.PointerEvent) => {
    const orb = activeOrbRef.current
    if (!orb) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    if (Math.hypot(e.clientX - orb.dragStartX, e.clientY - orb.dragStartY) < 4) toggleOrbPause(orb)
    orb.dragging = false
    activeOrbRef.current = null
  }

  const handleOrbKeyDown = (e: React.KeyboardEvent, i: number) => {
    const orb = orbsRef.current[i]
    if (!orb) return
    const actions: Record<string, () => void> = {
      ArrowUp:    () => { orb.y = Math.max(orb.r, orb.y - MOVE_STEP) },
      ArrowDown:  () => { orb.y = Math.min(window.innerHeight - (footerRef.current?.offsetHeight ?? BOTTOM_RESERVE_FALLBACK) - orb.r, orb.y + MOVE_STEP) },
      ArrowLeft:  () => { orb.x = Math.max(orb.r, orb.x - MOVE_STEP) },
      ArrowRight: () => { orb.x = Math.min(window.innerWidth - orb.r, orb.x + MOVE_STEP) },
      ' ':        () => toggleOrbPause(orb),
      Enter:      () => toggleOrbPause(orb),
    }
    const action = actions[e.key]
    if (action) { e.preventDefault(); action() }
  }

  const toggleGlobalPause = () => {
    const next = !isPaused
    setIsPaused(next)
    pauseAllOrbs(orbsRef.current, next, window.scrollY)
    setLiveMessage(next ? 'All orbs paused' : 'All orbs resumed')
  }

  return (
    <>
      <Header
        ref={headerRef}
        isPaused={isPaused}
        respectMotionPref={respectMotionPref}
        onTogglePause={toggleGlobalPause}
        onToggleMotionPref={() => setRespectMotionPref((r) => !r)}
      />

      <Main
        headlineText={HEADLINE_TEXT}
        orbDefs={ORB_DEFS}
        orbElsRef={orbElsRef}
        orbs={orbsRef.current}
        orbsHidden={orbsHidden}
        liveMessage={liveMessage}
        onOrbPointerDown={handleOrbPointerDown}
        onOrbPointerMove={handleOrbPointerMove}
        onOrbPointerUp={handleOrbPointerUp}
        onOrbKeyDown={handleOrbKeyDown}
        onOrbFocus={(label) => setLiveMessage(`${label} selected. Use Option plus arrow keys to move, Space to pause.`)}
      />

      <Footer ref={footerRef} stats={stats} />
    </>
  )
}
