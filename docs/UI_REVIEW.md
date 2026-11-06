# pro-ui-craft Part 5 review

Scope: every screen of the family app (welcome, intake 1–4, result, plan page, plan not found) and the staff console (login, pipeline, drawer, homes, match, insights, Monday check-in). The BUILD_SPEC color tokens, Public Sans and layout are kept exactly. This pass changes motion, interaction and polish only.

Already correct (no change): no `transition: all`, no `ease-in`, no `scale(0)` entries, no gradients/glass/emoji/arrows/caps eyebrows, tabular numerals on money and dates, rolling numbers, vertical date swap, shared `layoutId` highlight on segmented controls and tabs, skeletons sized like the final layout, optimistic ticks, `MotionConfig reducedMotion="user"`, 2px pine focus rings. Tailwind v4 already gates `hover:` behind `(hover: hover)`.

| Where | Before | After | Why |
|---|---|---|---|
| Global CSS easing | Only Motion tokens; CSS transitions used the browser default `ease` | `--ease-out`, `--ease-in-out`, `--ease-drawer` custom curves on `:root`, used by every CSS transform transition | Built-in curves are too weak; one motion personality everywhere |
| All exits (intake screens, toast, inline notes, upload/voice messages, aim sentence, drawer) | Exit used the same spring as the entrance | Shared `exit` token: 160ms ease-out tween (drawer 220ms) | Exits should be ~30% faster than entrances so the UI feels responsive |
| Segmented control (language toggle, yes/no, credit) | Highlight glided even when changed with arrow keys | Instant when the change came from the keyboard, glides only on pointer | Never animate keyboard-triggered actions |
| Segmented control radius | Outer 8px, 4px padding, inner highlight 6px | Inner highlight 4px | Concentric radii: inner = outer − padding |
| Language toggle (EN/ES) | 36px tall hit area | 44px hit area via pseudo-element, same 36px look | Hit areas ≥ 44px |
| Staff nav tabs, "Clear filters", "Regenerate plan", resource links in the checklist | 24–36px hit areas | 44px hit area via `.hit` pseudo-element | Hit areas ≥ 44px |
| Links styled as buttons (Download PDF, Download image, Start a new plan, Run Monday check-in, upload button) | No press state | `scale(0.97)` on `:active`, 160ms `--ease-out` | Every pressable element acknowledges the press, not only `<Button>` |
| Ready-date month swap | Two words crossfaded and visibly overlapped mid-swap | Adds `blur(2px)` at the midpoint of the swap | Fuses the crossfade so it reads as one word changing |
| Road milestone tooltip | Appeared instantly on any hover, including passing over | 400ms delay on first hover, instant for neighbors once one is open; focus/tap stay instant | Tooltip etiquette: no flicker while the pointer travels |
| Road and drawer tooltips/popovers | Grew from nothing (no transition) | 150ms fade + `scale(0.96→1)` with origin at the marker | Popovers scale from their trigger; nothing appears from nothing |
| Spinner | 1s per turn | 0.7s per turn | A faster spinner makes the same wait feel shorter |
| Headings | Ragged wraps leaving one-word last lines ("household" alone) | `text-wrap: balance` on h1/h2, `text-wrap: pretty` on paragraphs | Avoid orphans; titles read as designed |
| Text selection, caret | Browser blue | Selection `--pine-soft`, caret `--pine` | Small details match the palette |
| Share card thumbnail | Light image bled into the panel | 1px inner outline at 6% ink | Images keep their edge on light surfaces |
| Inputs `.field:hover` | Hover border change ungated (sticky on touch) | Gated by `(hover: hover) and (pointer: fine)` | No sticky hovers on phones |
| Homes list inside a panel | Inner rows rounded 14px inside a 14px panel with a 1px border | Inner corners 13px | Concentric radii |
| Checklist rows on first load | All rows rose together each time the plan re-rendered after "Regenerate plan" | Stagger only on first appearance (≤ 6 rows, 40ms), regenerated plans swap without replaying | Don't replay entrances on every update |
| Check-in rows | Rise animation with `(i % 3)` delays, could replay out of order | Rise once per row as it streams, 40ms cap, no layout animation on rows | Streamed rows should arrive in order; layout animations stutter during loads |
| Road markers' entrance | Scale 0.6 → 1 (BUILD_SPEC signature moment) | Kept. It's the screen's one signature reveal, exempt per both the spec and the skill | One signature moment per screen |
| One-accessory rule, result screen | "Ten years from now" chart replayed its draw animation after every slider drag (lever save re-rendered it), competing with the Road | Chart data is memoized on the inputs that change it (rent, income, co-applicant); debt and savings sliders no longer replay it | Remove the least necessary effect; the Road is the one thing that should move |
| Intake screen titles (found in the 390×844 screenshots) | A heavy 2px ring boxed the title after every Continue, because focus moves there for screen readers | Ring hidden on the programmatically focused title (focus still moves, still announced); controls keep their rings | A focus ring on a non-interactive heading reads as a bug, not as guidance |
| Road on phones (found in the 390×844 screenshots) | The right-edge scroll fade sat on top of the Keys marker and the last label even when the road fit the screen | Fade shows only when the road actually overflows and scrolls | A scroll hint with nothing to scroll hides the most important marker |

## Landing page (flagship) pass

| Where | Before | After | Why |
|---|---|---|---|
| Landing load | Static text and a button | One ~1.2s sequence: headline lines rise blur-to-sharp (0–0.5s), sample Road draws (0.3–0.8s), markers pop (0.8–1.0s), sample date rolls up (1.0–1.2s) | Flagship surface: motion is the substance, but it is one scene, not effects on every element |
| Landing interaction | Nothing to try before starting | "Extra toward debt" slider on a sample family moves the Keys marker and the date live | Show the product's best moment before asking for anything |
| Landing sections | (considered) scroll-reveal on "How it works" | Static | Fade-up on every section reads as template; one scene is enough |
| Reduced motion | n/a | No rise, blur or draw; short fades only | Respect the setting |
| Header | Staff console only at /staff (separate link) | Quiet "Staff sign in" text link top-right on every family page; login links back | One site, one link |
