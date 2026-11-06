---
name: pro-ui-craft
description: Use when building, restyling, or reviewing any web UI so it looks designed by a senior product designer and moves with crisp, purposeful animation instead of generic AI styling. Covers visual direction, motion timing and easing, micro-interactions, polish details, and a review checklist.
---

# Pro UI Craft

You are a design engineer. Your job is to make the interface feel inevitable: every spacing, curve and timing chosen on purpose, every detail correct even when nobody consciously notices it. Users can't name what makes a product feel premium, but they feel the sum of a thousand small correct decisions.

This skill combines the most respected public guidance on UI craft (Anthropic's frontend-design approach, Emil Kowalski's design-engineering principles from building Sonner and Vaul, and the "make interfaces feel better" polish rules) into one working method.

## How to use this skill

1. **On a new screen:** do Part 1 (direction) before writing code, then build with Parts 2–4.
2. **On an existing UI:** run the review in Part 5 first, output the findings table, then fix every row.
3. **If the project already has a design system or spec** (tokens, fonts, colors), keep its identity exactly. This skill then governs motion, interaction and polish only.

---

## Part 1. Direction: kill the generic look first

### Recognize AI slop
These patterns appear regardless of subject, which is why they read as machine-made. Don't use them unless the brief asks for them:
- Purple/indigo gradients, gradient text, gradient washes behind sections
- Cream background + serif headline + terracotta accent; or near-black + one neon accent
- Every section chopped into identical rounded cards with the same soft grey shadow
- ALL-CAPS tracked-out eyebrow labels above every heading
- "01 / 02 / 03" numbering on things that aren't a sequence
- Inter/Roboto/system font with no thought; emoji as icons; sparkle icons; "Powered by AI" badges
- An arrow "→" appended to every button
- Hover lift + shadow on every card; fade-and-slide-up on every section as you scroll
- Big number + small label + gradient accent as the default hero

### Make three real decisions
Write these down before coding:
1. **One subject-specific idea.** What does this product's world actually look like? (A mortgage tool borrows from bank statements and closing documents; a recipe app from cookbooks.) Pull form, vocabulary and palette from there.
2. **One place to be bold.** Pick a single memorable element (a signature visualization, one display number, one interaction) and keep everything around it quiet.
3. **One motion personality.** Crisp and fast for tools and dashboards; slightly softer for consumer and onboarding. Everything moves the same way.

### Visual foundations
- **Type does the hierarchy, not boxes.** Size, weight and spacing first; borders and backgrounds last. Two weights usually suffice (regular and semibold).
- **Use tabular numerals** (`font-variant-numeric: tabular-nums`) for any number that changes or aligns in a column.
- **Line length** 45–75 characters. Body 16px minimum on mobile.
- **`text-wrap: balance`** on headings, **`text-wrap: pretty`** on paragraphs to avoid orphans.
- **`-webkit-font-smoothing: antialiased`** on macOS for crisp text.
- **One accent color**, used only where the eye should go. Neutrals carry the rest.
- **Spacing on a 4px or 8px scale**, no arbitrary values.
- **Prefer hairlines and surface contrast over shadows.** If you use shadows, use one or two defined levels, layered (a tight dark one plus a wide soft one), never `rgba(0,0,0,.1)` everywhere.

---

## Part 2. Motion: the decision framework

Answer these four questions before writing any animation.

### 1. Should this animate at all?

| How often the user sees it | Decision |
|---|---|
| 100+ times a day (keyboard shortcuts, command palette) | No animation, ever |
| Tens of times a day (hovers, list navigation) | Remove or make nearly instant |
| Occasionally (modals, drawers, toasts) | Standard animation |
| Rarely or first time (onboarding, results reveal, success) | Room for delight |

**Never animate keyboard-triggered actions.** They're repeated constantly and animation makes them feel laggy.

### 2. What is it for?
Every animation needs an answer to "why does this move?" Valid answers:
- **Feedback:** a button compresses on press, so the UI heard you.
- **State change:** a control morphs to show it's now in a new state.
- **Spatial continuity:** something exits the way it came, so the user knows where it went.
- **Preventing a jarring jump:** content appearing or reflowing smoothly instead of popping.
- **Explanation:** showing how a value was derived or a feature works.

If the only answer is "it looks cool" and users will see it often, don't animate it.

### 3. Which easing?

```css
:root {
  --ease-out:    cubic-bezier(0.23, 1, 0.32, 1);    /* entering, exiting, UI responses */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* things moving across the screen */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* iOS-like sheets and drawers */
}
```

- Entering or exiting → `--ease-out`
- Moving or morphing on screen → `--ease-in-out`
- Color and opacity hover → plain `ease`
- Constant motion (progress, marquee) → `linear`
- **Never `ease-in` for UI.** It starts slowly at exactly the moment the user is watching, so it always feels sluggish.
- The built-in CSS curves are too weak. Always use custom curves like the ones above.

### 4. How long?

| Element | Duration |
|---|---|
| Button press feedback | 100–160ms |
| Tooltip, small popover | 125–200ms |
| Dropdown, select, menu | 150–250ms |
| Modal, drawer, sheet | 200–400ms |
| Page or step transition | 250–350ms |
| One signature reveal per screen | up to ~900ms |

**UI animation stays under 300ms** except the one signature moment. Exits are faster than entrances (roughly 70% of the enter time).

### Springs
Use springs for anything the user drags, interrupts or tracks with a pointer, and for values that settle (numbers, positions). Springs keep their velocity when retargeted; CSS keyframes restart from zero.

```js
// Motion for React. Easiest to reason about:
{ type: "spring", duration: 0.35, bounce: 0 }     // UI default: crisp, no overshoot
{ type: "spring", duration: 0.5,  bounce: 0.15 }  // panels, drawers, settling values
{ type: "spring", duration: 0.6,  bounce: 0.25 }  // drag-to-dismiss, playful moments only
```

Keep bounce at 0 for professional tools. Use 0.1–0.3 only for gestures and rare celebratory moments.

---

## Part 3. Interaction patterns that make it feel premium

### Press and hover
- Every pressable element compresses on `:active`: `transform: scale(0.97)` with `transition: transform 160ms var(--ease-out)`. Range 0.95–0.98.
- Gate hover effects so touch devices don't get sticky hovers:
  ```css
  @media (hover: hover) and (pointer: fine) { .card:hover { ... } }
  ```
- Hover changes color or background; it does not lift cards and add shadows.

### Entering and exiting
- **Never animate from `scale(0)`.** Start at `scale(0.95)` with `opacity: 0`. Nothing real appears from nothing.
- Combine small movement (6–12px) with opacity. Large travel distances feel cheap.
- Use CSS `@starting-style` for simple enter animations without JavaScript.
- Lists entering together: stagger 30–60ms per item, cap at about 6 items, and never block interaction during the stagger.

### Popovers, menus, tooltips
- Scale from the trigger: `transform-origin` set to where the trigger is (`var(--transform-origin)` in Radix and Base UI). **Modals are the exception** and stay centered.
- Tooltips: a short delay (~400ms) before the first one; once one is open, neighbors open instantly with no animation.

### Shared and morphing elements
- Segmented controls, tabs and toggles: one shared highlight element that glides between options (Motion `layoutId`).
- When a crossfade between two states looks like two overlapping objects, add `filter: blur(2px)` mid-transition to fuse them. Keep blur under ~20px; it's expensive in Safari.
- Changing numbers count to the new value with a spring instead of jumping. Use tabular numerals so digits don't wobble.
- Changing words (a date, a status) swap vertically: old moves up 6–8px and fades, new comes up from below.

### Drag and gestures
- Dismiss on velocity, not only distance: if `distance / time > 0.11` px/ms, dismiss even if the threshold wasn't reached.
- Past a boundary, add increasing resistance instead of a hard stop.
- Capture the pointer once a drag starts; ignore extra touch points mid-drag.

### Asymmetric timing
Slow where the user is deciding, fast where the system responds. A hold-to-confirm fills over 1.5–2s linear; releasing snaps back in 200ms.

### Loading and perceived speed
- Under 300ms: show nothing.
- 300ms–1s: an inline spinner inside the button, which keeps its width.
- Over 1s: a skeleton that matches the final layout's exact sizes.
- Stream generated text in progressively and let the container grow smoothly; never swap a spinner for a finished block.
- Use optimistic updates for toggles, ticks, saves and likes.
- A faster spinner makes loading feel faster at the same wait time.

---

## Part 4. Polish details professionals check

- **Concentric radii:** a nested element's radius = outer radius − padding. Mismatched nested radii are the most common reason UIs feel slightly off.
- **Hierarchy of radii:** small controls get small radii (6–8px), containers larger (12–16px). Never one radius on everything.
- **Optical alignment:** icons beside text and play-style glyphs need a 1–2px nudge to look centered. Trust the eye over the measurement.
- **Hit areas ≥ 44×44px**, even when the visible control is smaller (extend with padding or a pseudo-element).
- **No layout shift:** reserve space for images, async numbers and error messages. Target CLS < 0.02.
- **Images get a 1px inner outline** (`outline: 1px solid rgba(0,0,0,.06); outline-offset: -1px`) so light images don't bleed into the background.
- **Focus rings** visible, 2px, accent color, with offset; never `outline: none` without a replacement.
- **Every state is designed:** empty, loading, error, success, disabled, and long-content overflow. Empty states say what to do next.
- **Copy:** sentence case, buttons are verbs that say what happens ("Save plan", not "Submit"); the confirmation reuses that verb ("Plan saved").
- **Scrollbars, selection color and caret color** match the palette.
- **Dark mode only if it's done properly;** a good single light theme beats a half-finished pair.

### Performance rules
- Animate only `transform` and `opacity` (and `clip-path`/`filter` sparingly). Never `width`, `height`, `top`, `margin` or `padding`.
- Never `transition: all`. List the exact properties.
- Don't update a CSS variable on a parent every frame (it restyles all children); set `transform` on the element itself.
- Motion `layout` and `layoutId` animations run on the main thread and can stutter during page loads. For predetermined animations prefer CSS or the Web Animations API, which run off the main thread.
- Add `will-change: transform` only to elements that are actually about to animate, and remove it after.
- Test at 4× CPU throttle in DevTools. If it drops below 60fps, simplify.

### Accessibility
- Respect `prefers-reduced-motion`: remove movement and scale, keep short opacity and color transitions (≤150ms) that aid understanding. In Motion: `<MotionConfig reducedMotion="user">`.
- Text contrast ≥ 4.5:1; large text ≥ 3:1.
- Everything reachable and operable by keyboard, in a sensible order.

---

## Part 5. Review method (use this on existing UI)

Go screen by screen. Output **one markdown table** with every issue, then fix every row:

| Where | Before | After | Why |
|---|---|---|---|
| Primary button | no `:active` state | `scale(0.97)` on press, 160ms ease-out | UI must acknowledge the press |
| Dropdown | `ease-in` 400ms from `scale(0)` | `--ease-out` 180ms from `scale(0.95)` + opacity, origin at trigger | ease-in feels slow; nothing appears from nothing |
| Card hover | translateY(-4px) + shadow | background tint only, gated by `(hover:hover)` | lift-and-shadow reads as template |

### The checklist

| Look for | Fix |
|---|---|
| Any item from the AI-slop list in Part 1 | Remove or replace with a subject-specific choice |
| `transition: all` | Exact properties |
| `scale(0)` entry | `scale(0.95)` + opacity |
| `ease-in` on any UI element | `--ease-out` or custom curve |
| UI animation > 300ms (not the signature moment) | 150–250ms |
| Animation on a keyboard action or a 100×/day action | Remove |
| Popover scaling from center | Origin at trigger (modals exempt) |
| Hover effects not gated | `@media (hover: hover) and (pointer: fine)` |
| Same enter and exit speed | Exit ~30% faster |
| Everything appears at once | Stagger 30–60ms, max ~6 items |
| Keyframes on rapidly retriggered UI | CSS transitions or springs |
| Numbers that jump | Spring count-up with tabular numerals |
| Mismatched nested radii | Outer = inner + padding |
| Hit area < 44px | Extend with padding or a pseudo-element |
| Layout shift on load or async data | Reserve space; skeletons match final size |
| Missing empty / error / loading state | Design it |
| Animating width/height/top/margin | transform/opacity |
| No reduced-motion handling | Add it |

### Verify with your own eyes
1. Screenshot every screen at 390×844 and 1440×900 and look at them. Ask: "Would a design lead at Linear, Stripe or Apple ship this?" If anything looks templated, change it.
2. Record the key interactions (Playwright `video: 'on'`), then watch at 0.25× speed or frame by frame in Chrome DevTools' Animations panel. Look for overlapping crossfades, wrong transform origins, out-of-sync properties, and anything that starts or stops abruptly.
3. Test on a real phone for touch, hover and drag behavior.
4. Before finishing, apply the "one accessory" rule: remove the least necessary effect on each screen.
