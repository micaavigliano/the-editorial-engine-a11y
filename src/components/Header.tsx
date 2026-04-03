import { forwardRef, useEffect, useState } from 'react'

type Props = {
  isPaused: boolean
  respectMotionPref: boolean
  onTogglePause: () => void
  onToggleMotionPref: () => void
}

const HeaderContent = ({ isPaused, respectMotionPref, onTogglePause, onToggleMotionPref }: Props) => (
  <>
    <div className="header-controls" aria-label="Animation controls">
      <button className="control-btn-dark" aria-pressed={isPaused} onClick={onTogglePause}>
        {isPaused
          ? <><span aria-hidden="true">▶ </span>Play</>
          : <><span aria-hidden="true">⏸ </span>Pause</>}
      </button>
      <button className="control-btn-dark" aria-pressed={respectMotionPref} onClick={onToggleMotionPref}>
        Respect reduced-motion
      </button>
    </div>
    <nav aria-label="Keyboard shortcuts" className="header-nav">
      <ul role="none" className="header-hints">
        <li>Drag to move orbs with mouse</li>
        <li>Click an orb to pause it</li>
        <li><kbd aria-hidden="true">Esc</kbd><span className="sr-only">Escape</span> to pause or resume all</li>
        <li><kbd aria-hidden="true">Tab</kbd><span className="sr-only">Tab</span> then <kbd aria-hidden="true">Arrows</kbd><span className="sr-only">arrow keys</span> to focus and move orbs</li>
        <li><kbd aria-hidden="true">Enter</kbd><span className="sr-only">Enter</span> or <kbd aria-hidden="true">Space</kbd><span className="sr-only">Space</span> to pause focused orb</li>
      </ul>
    </nav>
  </>
)

export const Header = forwardRef<HTMLElement, Props>((props, ref) => {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const check = () => {
      const zoom = window.outerWidth / window.innerWidth
      setCompact(zoom >= 2 || window.innerWidth < 500)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!compact) {
    return (
      <header ref={ref} className="site-header">
        <HeaderContent {...props} />
      </header>
    )
  }

  return (
    <header ref={ref} className="site-header site-header--compact">
      <details className="header-collapse">
        <summary className="header-toggle">
          <svg className="header-toggle-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="16" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor"/>
          </svg>
          Controls &amp; shortcuts
        </summary>
        <div className="header-collapse-content">
          <HeaderContent {...props} />
        </div>
      </details>
    </header>
  )
})
