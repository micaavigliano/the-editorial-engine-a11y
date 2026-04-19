# What I did

I took the [demo for a editorial engine](https://somnai-dreams.github.io/pretext-demos/the-editorial-engine.html) built with [pretext](https://github.com/chenglou/pretext) by Cheng Lou and I made it fully accessible, with semantic HTML structure, keyboard operability, screen reader support, and `prefers-reduced-motion` compliance. The result is a high-performance text layout demo that meets WCAG 2.2 success criteria while not compromising aesthetics and performance. The orbs are still draggable with the mouse but I also added the possibility of moving them using the keyboard.

The app uses a **dual rendering system**. At normal zoom, pretext powers a visual stage where text lines are individually positioned and wrap dynamically around the orbs as circular obstacles. Underneath, a native HTML `<article>` with CSS `column-count` remains in the DOM for screen readers, copy/paste, and find-in-page. At high zoom (≥150%) or narrow viewports (<500px), the pretext stage is removed entirely and the native HTML article becomes the visible layout, ensuring text is always fully readable, selectable, and copyable. A pretext-rendered drop cap provides the decorative initial letter in the visual stage, while CSS `::first-letter` handles it in the native fallback.

### Pretext library usage

Pretext powers the orb animation system. The following APIs are available in the project:

| API | Purpose | Where used |
|-----|---------|------------|
| `prepareWithSegments()` | Measures and caches word widths for text blocks | Body text preparation on font load |
| `layoutNextLine()` | Lays out one line of text at a given max width | Core layout loop — wraps text around orb obstacles |
| `layoutWithLines()` | Lays out all lines of a prepared text block | Headline fitting to available width/height |
| `walkLineRanges()` | Iterates line ranges without allocating line objects | Text measurement utilities |

## Accessibility improvements

### Semantic HTML structure

The app uses proper HTML5 landmarks and semantic elements:

- `<header>`: Fixed bar with controls and interaction hints
- `<main>`: Primary content area
- `<article lang="es">`: Full readable text as native HTML; `lang="es"` switches screen readers to Spanish pronunciation
- `<section>`: Orb container with descriptive `aria-label`, exposed as a named region
- `<footer>`: Performance stats and credits
- `<kbd>`: Keyboard shortcuts styled as keycaps. `aria-hidden` prevents SR double-announcement; `sr-only` siblings provide the readable text
- `<cite>`: Book title attribution
- `<nav>`: Keyboard shortcuts and credits navigation

### Keyboard accessibility

Every interactive element is operable without a mouse:

| Action | Key | With VoiceOver |
|--------|-----|----------------|
| Toggle global pause | `Esc` | `Esc` |
| Navigate to orbs | `Tab` | `Tab` |
| Move focused orb | `Arrow keys` | `Option + Arrow keys` |
| Pause/resume individual orb | `Space` | `Space` |

Orbs are native `<button>` elements. `aria-roledescription="draggable orb"` augments the role announcement so the user understands these are not ordinary buttons. Each orb's `aria-label` is dynamic and encodes its position in the set, the available interactions, and its current pause state.

### Screen reader orb interaction discovery

When a VoiceOver user tabs to an orb, they hear: "Golden orb, 1 of 5. Use Option plus arrow keys to move. Press Space to pause." The instruction lives inside the `aria-label` because VoiceOver captures plain arrow keys for its own navigation; the page tells the user which key combination it *can* receive (`Option + Arrow`) instead of attempting to override the screen reader. When the orb is paused, the label changes to "Press Space to resume."

### Screen reader support

- **`aria-live="polite"`**: Announces orb selection, pause/resume, and state changes without interrupting the user
- **`aria-pressed`**: Toggle buttons communicate their on/off state
- **`aria-label`**: Every interactive element has a descriptive, dynamic label

### `prefers-reduced-motion` support

When the user's OS or browser has reduced motion enabled:

- All orb animation stops, orbs render at their initial positions, static
- CSS `scroll-snap-type` and `scroll-behavior: smooth` are disabled
- CSS transitions and animations are suppressed globally via `animation-duration: 0.01ms !important`
- A toggle button allows users to override this preference in-app

### Pause control

- **Global pause** (button or `Esc`): Stops all orbs. Paused orbs freeze in their document position and don't move when the user scrolls.
- **Individual pause** (click or `Space` on a focused orb): Only that orb stops. Other orbs keep moving. This allows users to control exactly which elements are in motion.
- The global pause button reflects the aggregate state. If all orbs are individually paused, it shows "Play"; if all are moving, it shows "Pause".

## Text content and layout

### Dual rendering: pretext stage + native HTML

Implementation details behind the dual layout described above:

- **Pretext visual stage** (`aria-hidden="true"`): Each line is an absolutely positioned `<div>` laid out by `layoutNextLine()`, wrapping around orbs as circular obstacles. The stage's height is computed from the lowest line position.
- **Native HTML article**: When the pretext stage is active, the `<article lang="es">` is visually hidden with `position: absolute; left: -9999px` (not `display: none`, so AT still reads it).
- A `useNativeLayout` state derived from `window.outerWidth / window.innerWidth` decides which mode is active.

| Viewport | Columns (both modes) |
|----------|---------|
| > 1000px | 3 columns |
| 641-1000px | 2 columns |
| ≤ 640px | 1 column |

### Text wrapping around orbs

In the pretext stage, each orb's position and radius are converted to a circular obstacle via `orbToObstacle()`. The layout engine (`layoutAllText()`) feeds these obstacles to `layoutNextLine()`, which shortens or shifts lines to flow around the orbs in real time as they move.

### Headline fitting

The headline is dynamically sized using `fitHeadline()`, which uses pretext's `layoutWithLines()` to find the largest font size that fits the headline within the available width and a max height (35% of viewport, or 20% on short screens). Each headline line is rendered as a separate absolutely positioned element.

### Drop cap

In the pretext stage, the first character of the first paragraph is rendered as a positioned `<div>` spanning 3 body lines in height. The layout engine reserves a rectangular region for the drop cap and flows the first paragraph's text around it. In native mode, CSS `::first-letter` provides the same effect.

### Dynamic header clearance

The article's `padding-top` uses a CSS custom property `--header-h` set by a `ResizeObserver` on the fixed header. In the pretext stage, the top gutter is computed as `Math.max(GUTTER, headerHeight + 8)`. This ensures content is never hidden behind the header at any zoom level or viewport size.

## Mobile and responsive behavior

### Orbs and pretext stage hidden on small screens and high zoom

At the 500px / 150%-zoom threshold, React conditionally unmounts the orb `<section>` and the pretext stage entirely (not `display: none`), and `useNativeLayout` also halts the `renderFrame` loop so no layout work runs in the background.

Zoom detection uses `window.outerWidth / window.innerWidth`: when the user zooms in, `innerWidth` shrinks while `outerWidth` stays constant, giving the actual zoom ratio.

### Collapsible header at high zoom

At 200%+ zoom or viewports below 500px, the header switches to a compact mode where all controls and keyboard shortcuts collapse behind a native `<details>`/`<summary>` toggle, preventing the fixed header from consuming the viewport at high magnification.

A `ResizeObserver` on the header keeps the `--header-h` CSS custom property in sync as it expands or collapses, so article content always clears it without overlap.

### Mobile header and footer

On screens below 640px:
- The header collapses to a single toggle (same `<details>`/`<summary>` mechanism as high zoom)
- The footer stacks vertically (stats centered, credits below)
- Button text and hint font sizes reduce for touch targets
- Text reflows to a single readable column

## Scroll snapping

`html { scroll-snap-type: y proximity; scroll-behavior: smooth; }` snaps near-alignments without trapping keyboard scroll (`Space`, `Page Down`, arrows keep working because the type is `proximity`, not `mandatory`). Under `prefers-reduced-motion: reduce`, both properties fall back to `auto` / `none`.

## WCAG success criteria

| Criterion | Level | Status | Notes |
|-----------|-------|--------|-------|
| 1.3.1 Info and Relationships | A | Pass | Semantic HTML conveys structure programmatically |
| 1.3.2 Meaningful Sequence | A | Pass | DOM order matches visual reading order |
| 1.3.4 Orientation | AA | Pass | Layout adapts to portrait and landscape |
| 1.4.1 Use of Color | A | Pass | Pause state uses opacity + SR announcement, not color alone |
| 1.4.3 Contrast (Minimum) | AA | Pass | All text meets 4.5:1 ratio |
| 1.4.4 Resize Text | AA | Pass | Native HTML reflows at 200% zoom; orbs removed at 150%+ to prevent obstruction |
| 1.4.10 Reflow | AA | Pass | CSS columns reflow to single column at 320px width, no horizontal scroll |
| 1.4.11 Non-text Contrast | AA | Pass | Focus indicators meet 3:1 against adjacent colors |
| 2.1.1 Keyboard | A | Pass | All functionality available via keyboard |
| 2.1.2 No Keyboard Trap | A | Pass | `scroll-snap-type: proximity` (not `mandatory`), no focus traps |
| 2.2.2 Pause, Stop, Hide | A | Pass | Global and per-orb pause controls, `Esc` shortcut |
| 2.3.3 Animation from Interactions | AAA | Pass | `prefers-reduced-motion` respected, manual toggle available |
| 2.4.1 Bypass Blocks | A | Pass | Landmark navigation via `<header>`, `<main>`, `<footer>` |
| 2.4.3 Focus Order | A | Pass | Tab order follows logical document structure |
| 3.1.1 Language of Page | A | Pass | `lang="en"` on `<html>`, `lang="es"` on Spanish text |
| 3.1.2 Language of Parts | AA | Pass | Spanish text scoped with `lang="es"` |
| 4.1.2 Name, Role, Value | A | Pass | Buttons have labels, toggles have `aria-pressed`, live regions announce changes |

## Tech stack

- [Claude](https://claude.ai/) calculations, editing and README writing.
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/) 5.9
- [Vite](https://vite.dev/) 8
- [@chenglou/pretext](https://github.com/chenglou/pretext) 0.0.3
- [Atkinson Hyperlegible](https://brailleinstitute.org/freefont), font designed by the Braille Institute for maximum readability
