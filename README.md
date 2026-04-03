# What I did

I took the [demo for a editorial engine](https://somnai-dreams.github.io/pretext-demos/the-editorial-engine.html) built with [pretext](https://github.com/chenglou/pretext) by Cheng Lou and I made it fully accessible, with semantic HTML structure, keyboard operability, screen reader support, and `prefers-reduced-motion` compliance. The result is a high-performance text layout demo that meets WCAG 2.2 success criteria while not compromising aesthetics and performance. The orbs are still draggable with the mouse but I also added the possibility of moving them using the keyboard.

The text content uses native HTML with CSS `column-count` for multi-column layout, ensuring text is always fully readable, selectable, and copyable at any zoom level. The browser handles reflow natively — no custom layout engine for the text means paragraphs are never cut or lost. A CSS `::first-letter` pseudo-element provides the drop cap effect. The orbs float as decorative overlays on top of the text.

### Pretext library usage

Pretext powers the orb animation system. The following APIs are available in the project:

| API | Purpose | Where used |
|-----|---------|------------|
| `prepareWithSegments()` | Measures and caches word widths for text blocks | Text preparation utilities |
| `layoutNextLine()` | Lays out one line of text at a given max width | Layout engine (available for custom layouts) |
| `layoutWithLines()` | Lays out all lines of a prepared text block | Headline fitting utilities |
| `walkLineRanges()` | Iterates line ranges without allocating line objects | Text measurement utilities |

## Accessibility improvements

### Semantic HTML structure

The app uses proper HTML5 landmarks and semantic elements:

- `<header>`: Fixed bar with controls and interaction hints
- `<main>`: Primary content area
- `<article lang="es">`: Full readable text as native HTML — visible, selectable, and copyable
- `<section>`: Orb container with descriptive `aria-label`
- `<footer>`: Performance stats and credits
- `<kbd>`: Keyboard shortcuts styled as physical keycaps (with `aria-hidden` to prevent double announcement; sr-only spans provide the text)
- `<cite>`: Book title attribution
- `<nav>`: Keyboard shortcuts section and credits navigation

#### Why correct HTML semantics matter

1. **Users with disabilities**: Screen readers use landmarks (`<header>`, `<main>`, `<footer>`) for navigation. A screen reader user can press a single key to jump between landmarks rather than tabbing through every element. `lang="es"` on the text region tells the screen reader to switch to Spanish pronunciation.

2. **Search engine crawlers**: Crawlers rely on semantic structure to understand content hierarchy. `<h1>` establishes the page topic. `<cite>` identifies referenced works. Native visible HTML means all content is indexable without workarounds.

3. **AI systems and LLMs**: AI agents parsing web content use the same semantic signals as crawlers. Landmark roles, heading hierarchy, and structured elements allow AI to extract meaning without relying on visual layout.

### Keyboard accessibility

Every interactive element is operable without a mouse:

| Action | Key | With VoiceOver |
|--------|-----|----------------|
| Toggle global pause | `Esc` | `Esc` |
| Navigate to orbs | `Tab` | `Tab` |
| Move focused orb | `Arrow keys` | `Option + Arrow keys` |
| Pause/resume individual orb | `Space` | `Space` |

Orbs are `<button>` elements, which tells VoiceOver to pass arrow keys through to JavaScript instead of consuming them for SR navigation. The `aria-roledescription="draggable orb"` provides a clear role announcement. Each orb's `aria-label` dynamically updates to reflect its pause state: "Press Space to pause" when moving, "Press Space to resume" when paused.

### Screen reader orb interaction discovery

When a VoiceOver user tabs to an orb, they hear: "Golden orb, 1 of 5. Use Option plus arrow keys to move. Press Space to pause." This instruction is critical because VoiceOver normally captures arrow keys for its own navigation. The `role="application"` on each orb button switches VoiceOver into a pass-through mode where arrow keys go directly to the page's JavaScript, enabling orb movement.

When the orb is paused, the label changes to: "Press Space to resume.", so the user always knows the current action available without guessing.

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

The article text (excerpts from *Cien años de soledad*) is rendered as native HTML inside an `<article>` element with CSS multi-column layout:

| Viewport | Columns |
|----------|---------|
| > 1000px | 3 columns |
| 641-1000px | 2 columns |
| ≤ 640px | 1 column |

### Why native HTML over a custom layout engine

The original demo used a canvas-based layout engine with absolutely positioned `<div>` elements per line. This approach caused:

- **Cut paragraphs**: Text was truncated at page boundaries in multi-column mode
- **Lost content**: Information was omitted at column breaks, especially at high zoom
- **Uncopyable text**: Each line was a separate positioned element, making text selection impractical
- **Reflow failures**: The custom math broke at 200%+ zoom and narrow viewports

The native HTML approach solves all of these:

- **No cut text**: The browser handles line wrapping and column breaks natively
- **Fully copyable**: Standard text selection works across paragraphs
- **Perfect reflow**: CSS `column-count` adapts to any viewport width or zoom level
- **Drop cap**: CSS `::first-letter` provides the decorative initial without JavaScript

### Dynamic header clearance

The article's `padding-top` uses a CSS custom property `--header-h` set by a `ResizeObserver` on the fixed header. This ensures content is never hidden behind the header at any zoom level or viewport size, since the header height varies (it stacks vertically on mobile/high zoom).

## Mobile and responsive behavior

### Orbs hidden on small screens and high zoom

When the viewport width is below 500px or the browser zoom level reaches 150% or higher, the orbs are completely removed from the DOM. This is not a CSS `display: none`. The React component conditionally unmounts the entire orb `<section>`.

Zoom detection uses `window.outerWidth / window.innerWidth`. When the user zooms the browser, `innerWidth` shrinks while `outerWidth` stays constant, giving the actual zoom ratio.

### Collapsible header at high zoom

At 200%+ zoom or viewports below 500px, the header switches to a compact mode: all controls and keyboard shortcuts collapse behind a single toggle. This prevents the fixed header from consuming a large portion of the viewport at high magnification.

The toggle uses a native `<details>`/`<summary>` element, which provides built-in accessibility:

- **Keyboard operable**: `Enter` or `Space` toggles open/closed — no JavaScript event handling needed
- **Screen reader state**: Browsers announce "collapsed"/"expanded" automatically, no `aria-expanded` attribute required
- **Tab order**: Content inside is focusable when expanded and removed from the tab order when collapsed
- **No ARIA needed**: The semantics are built into the HTML element itself

A `ResizeObserver` on the header keeps the `--header-h` CSS custom property updated as the header expands or collapses, so the article content always clears it without overlap.

### Mobile header and footer

On screens below 640px:
- The header collapses to a single toggle (same `<details>`/`<summary>` mechanism as high zoom)
- The footer stacks vertically (stats centered, credits below)
- Button text and hint font sizes reduce for touch targets
- Text reflows to a single readable column

## CSS `scroll-snap-type` and user experience

The app uses native CSS scroll snapping:

```css
html {
  scroll-snap-type: y proximity;
  scroll-behavior: smooth;
}
```

### Accessibility behavior

- Under `prefers-reduced-motion: reduce`, both `scroll-snap-type` and `scroll-behavior: smooth` are disabled entirely, falling back to native browser scroll
- Keyboard scroll (`Space`, `Page Down`, `Arrow keys`) works normally. The snap behavior only engages when the scroll naturally lands near a snap point

## WCAG success criteria

The following WCAG 2.2 success criteria are relevant to this project:

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
