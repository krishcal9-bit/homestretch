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

## Landing redesign (flagship) — Part 5 pass

| Where | Before | After | Why |
|---|---|---|---|
| Layout at 1440 | 560px phone column centered on desktop | 1280px 12-column grid; hero 5/7 from 1280px, 6/6 on tablets, stacked on phones; vertically centered in the first viewport | A narrow column floating in space reads as unfinished |
| Hero demo | Demo boxed in a bordered card | Uncontained: 80px brass date (scales down with its container), large Road, big slider; one faint pine glow behind the date | Cards around the hero read as template; the product is the hero |
| Road labels | Labels stacked and collided ("Orientation / Down payment saved / …") | Markers < 72px apart share one label ("Orientation + application", "A + 3 more"); labels alternate above/below; collisions flip side or merge until nothing overlaps; Keys and highlighted milestones always keep their own label | Never overlap; the Keys marker is what the slider moves |
| "How it works" | Icon-in-a-square list | Deleted; replaced by three scroll scenes with real product UI | The most common AI pattern |
| Load sequence | Blur on the headline only | One ~1.4s movement: lines slide up through masks (80ms stagger, no blur) → subline/buttons fade up 12px at 350ms → Road draws 500–1300ms with `--ease-in-out`, each marker popping in when the line reaches it → date odometers through three earlier months 900–1400ms → slider thumb nudges once at 1400ms. Once per visit; reduced motion gets the final state with a 150ms fade | Orchestrated, not decorative |
| Date odometer (found on video) | Showed the final date immediately; settle state was decided before hydration | Settles only after the intro plays | The signature beat was missing |
| Road on first paint (found on video) | Rendered at a fallback width, so marker springs slid into place; labels popped before the line arrived | Nothing draws until measured; label entrances wait for the line | Nothing should pop or slide without a reason |
| Interaction | One slider | Bigger slider, family toggle (Reyes · Nguyen) with gliding highlight that morphs the Road and rolls the date, marker label cards that grow from the marker (160ms), 2° cursor tilt on fine pointers only (spring 120/20) | Alive, not gimmicky |
| Scroll story | — | Phone intake fills field by field as it scrolls in (mic pulses once); Road pinned while three captions pass and light up their milestone (scale 1.15, label to ink); browser-frame staff Homes view with counts climbing from 0 | Real product, transform/opacity only; 60fps at 4× CPU throttle (p95 16.7ms) |
| Phone scene | Animated `background-color` on fields and mic | Opacity-only overlays | Animate only transform and opacity |
| Pinned captions (axe) | Inactive captions at 25% opacity failed contrast | Only the large title dims (to 60%, ≥ 3:1); body text stays full contrast | Contrast floor |
| Family line on phones | Clipped (single-line swap) | Wraps | Never truncate |
| Footer code field | Placeholder in tracked caps | Sentence-case placeholder | No caps labels |
| No JavaScript | Intro-hidden content would stay invisible | `<noscript>` reveals it | Content first |
| Header | 56px solid bar | 64px; transparent at the top of the landing, surface + hairline after 24px (200ms fade); wide on the landing | Chrome recedes |
| Page transitions | Hard cuts | View Transitions: "Find my date" morphs into the intake progress bar; steps slide 24px (forward left, back right, 280ms enter / 200ms exit); last step → result shares the Road (small preview grows into the result Road); staff gets a crisp 200ms fade; browser back reverses. Motion fallback where unsupported | Spatial continuity |
| Intake Road preview (axe) | `aria-hidden` but focusable markers | `inert` | Hidden content can't take focus |

## Round 3 — opening, living street, carry-through (Part 5 pass)

Volume order kept: landing > result and plan > intake > staff. Only one thing moves on its own at a time (the skyline's single glowing window, every 2.5s for 1.2s, paused when the tab is hidden or motion is reduced).

| Where | Before | After | Why |
|---|---|---|---|
| Landing first visit | Hero animated in; no opening moment | ~2.4s opening on blank paper: a pine line draws across the middle, rises into a one-stroke house, the door fills brass, "Homestretch" fades in; then the camera pulls back — the line scales into the real Road track and the house shrinks onto the Keys marker (spring, bounce 0) while the headline rises (70ms stagger), the date odometers, and the pine fill passes each marker. Once per session; click or any key skips straight to the final hero; reduced motion: 150ms fade | One subject-specific signature moment |
| Opening first paint (found on video) | Header and partner line flashed before the overlay mounted | Inline pre-paint veil in `--paper` on first-session visits to `/` only (not reduced motion, not without JS) | "Starts as plain paper" |
| Opening handoff (found on video) | The house faded at the Keys spot, then Keys popped last | The Keys marker and its label appear the moment the house lands | The house becomes Keys |
| Hero horizon | Empty bottom of the first viewport | A street of 16 line-drawn houses on a ground line, drawn in left to right (40ms stagger); one window glows at a time; ≤8px parallax opposite the cursor on fine pointers | The horizon the Road heads toward |
| Demo feedback | Date changed silently | "7 months sooner" pine pill (scale 0.95→1, 160ms, fades 1.5s after the last change), "3 months later" in `--ink-2`; pine fill from Today to the ready date glides with the slider; markers that become reachable sooner pulse 1.1×; the Keys marker flashes brass and one street window lights together; "Drag to see what changes" until the first drag | Make the play rewarding |
| Delta pill (found by e2e) | Every value mounted a new pill; up to 10 stacked during a fast drag | One pill; only its text swaps | No overlap |
| Ticker | — | 56px strip under the hero, labelled "Sample families", one line from the seed data every 3s (old rises out 8px, new rises in, 250ms); wraps to two lines on phones instead of truncating | Real product activity, no invented names |
| Scroll scenes | Captions static | Captions rise from masks on entry; the pinned Road scene has the street under it and lights the last house at "Keys"; Homes rows stagger in with house glyphs and counts climbing; a pine spine down the left margin draws with scroll (scaleY) | One road through the page |
| Closing | Light band | The only dark section: pine band, white sentence, both 100s roll up from 0 on entry, white button | A closing beat |
| Skyline performance (4× throttle) | Lighting a window re-rendered 16 animated houses; 7 slow frames on a full scroll | Street memoized; lit windows are cheap overlays; second pass 0 slow frames, median/p95 16.7ms; first pass 4 one-time mount frames | Animate only what moves |
| Intake progress | Thin bar | A small Road: pine line growing toward a house; the door turns brass on the last step; it is the shared element that grows into the result Road | Same language, calmer |
| Intake questions | Static title | Question rises from a mask (320ms), fields fade up 60ms behind it; faint static street at 40% at the bottom | Under 400ms, nothing delays the user |
| Steppers, currency fields | Numbers jumped | Values roll to the new number when changed by a tap, scan or voice (typing shows plain text) | Numbers count |
| Pay-stub / voice fill | All fields washed at once | Each filled field washes pine-soft one after another, 80ms apart | You see the form fill itself in |
| Intake title focus ring (found in screenshots) | A heavy ring boxed the title after Continue (the earlier fix lost to the unlayered global rule) | Exempted in the same unlayered layer | Headings aren't controls |
| Result | — | Street under the Road: the Keys house door turns brass when the date settles; each ticked plan item lights a window; "Why this date" lines rise 50ms apart; "Aim for a specific home" lifts the chosen home's card from its row into place beside the Keys marker of a small Road that re-flows as the sliders glide; "Ten years from now" lines draw when scrolled into view and equity counts up | Calmer than the landing, same language |
| Result Road at 390 (found in screenshots) | Keys marker clipped (min width 340 > panel) | Min width 280; labels merge as needed | Keys always visible |
| Plan page | Full 900ms draw | 600ms draw (families revisit it), same street with windows per ticked item | Shorter for return visits |
| Staff (merged from the staff pass) | Hard cuts between tabs | 12px slide + crossfade (200ms in, 140ms out); Pipeline rows stagger on first load only (20ms, max 8); filtering fades/reflows; drawer Road draws in 400ms; Homes rows get line-drawn houses and counts that roll up when visible; nothing moves on its own | The calmest surface |

## Round 4 — Blueprint to keys, sections, illustrations, every page (Part 5 pass)

Volume order kept: landing > result and plan > intake > staff. One ambient animation per view (hero: the walking window light; scene 3: the ticker; scenes 1–2: the arrow bob). Only transform, opacity, clip-path and SVG pathLength animate; hover and focus colour feedback (120ms) is the one exception, kept as state feedback. Measured at 4× CPU throttle on an idle machine: landing intro and section pass median/p95 16.7ms (the only long tasks are hydration, before the first visible beat); intake steppers and typing 0 frames over 34ms; result lever drag median 16.7ms, 0–1 frames over 34ms per drag. Lighthouse mobile: `/` 93 (CLS 0), `/start` 87 (CLS 0.009), `/plan/[code]` 91 (CLS 0.007); accessibility 100 on all three. Screenshots: `docs/screenshots/r4-landing-*` (every section) and `r4-page-*` (every page) at 1440, 1024 and 390. Videos: `docs/motion/r4-intro-load{1,2,3}-1440.webm`, `r4-sections.webm`, `r4-flow-390.webm` (landing → intake → result with a lever drag), `r4-intake.webm`, `r4-result.webm`, `r4-staff.webm`, reviewed frame by frame.

| Where | Before | After | Why |
|---|---|---|---|
| Landing intro (frame 1) | The house's window light showed before anything was built | Light group starts at opacity 0 and turns on after the build | The light is the payoff, not the opening |
| Intro handoff | `layoutId` can't cross from the overlay into the Road's SVG | Measured move: the ground line and house transform onto the hero's track and Keys house | The house becomes Keys with no pop |
| Intro end (4× throttle) | Ending the intro re-rendered every section (67ms task) | Sections memoized; the intro's end is a fade with nothing re-rendering | 60fps through the handoff |
| Section activation (4×) | Mounting an illustration was one 68–89ms task, sometimes mid-scroll | Waits for the scroll to settle; text commits first, the illustration one frame later, the 100 houses a frame after that | No long task after load |
| Returning to a section | Finished content popped to blank, then replayed | Content clears once fully out of view, so a return slides in clean and animates | Same as the first visit |
| Keys house label (390) | "Keys" sat on the roof; other labels crossed the house | Keys labelled above the roof, outside the label lanes; above-track labels avoid the house's box | Nothing overlaps |
| Dot rail (1024) | Overlapped the hero date | Shown from 1280px; arrows and keys do the job below | No collisions |
| Closing arrow | Invisible over the light footer | Sits in the pine band, white outline | Visible, 44px |
| Neighborhood map | Dots animated `cx`/`cy`; badges appeared at their final count | Dots move by transform; badges roll up from 0 | Transform only; numbers count |
| Hundred houses | Each icon animated `fill` | Outline + fill layer that fades in (opacity, 8ms stagger, CSS) | Off the main thread |
| Arrow bob | Bobbed on every section | Only on sections with no other ambient motion | One ambient animation at a time |
| Intake stepper (4×) | `popLayout` injected a stylesheet on every tap: 5–7 slow frames per 16 taps before the pass, 14–20 with the first illustrated version | Number rolls on the Web Animations API; ± press is a CSS `:active` scale; screens memoized | 0 slow frames |
| Intake illustrations | Pivots off; coins read as a database icon; cramped floor plan; upload button wrapped | Fixed on video review; household house has a pine door | Brass stays for Keys |
| Result street | Cropped at both ends, so lit windows and the Keys door never showed | Sized to its own aspect ratio | The payoff is visible |
| Road marker pulse | `key={pulse}` remounted the marker (and the Keys house) every month the date got earlier | Pulse animates in place (motion value) | The drag's remaining long frames |
| Keys house build timing | Each screen copied the Road's spacing to time the build | The Road exports `keysReachAt`; the build defaults to the marker's own delay | One source of truth |
| Keys house light | Every later light waited ~1s (the build delay) | Only the first light waits; later ones are immediate | Feedback is instant |
| Date and pill during a drag | Exiting copies stacked ("August 2028" over "January 2030") | Changes within 180ms of each other swap instantly; single changes keep the 200ms vertical swap | No ghosting |
| `monthName` / `money` | New `Intl` formatter per call (hot in the drag profile) | One cached formatter per language and style | Less work per frame |
| Disclosures (income, voice, aim, text-me, notes) | Animated `height: auto` | Unroll by clip-path with a 4px rise; clip removed afterwards so focus rings show | Transform / opacity / clip-path only |
| Date swaps | Blur filter and `popLayout` | Opacity + 8px move in one grid cell | Cheaper, same look |
| Road progress fill | Animated the `x2` attribute | Animates `pathLength` | Allowed property |
| Progress door, skeletons, filled wash | Animated fill, background position, background colour | Opacity on an overlay | Allowed property |
| Counselor packet | Static send, toast only | A paper sheet slides up and its text streams in; the toast and one Download pulse wait for the send to succeed | Says what happened |
| Staff pipeline filter | Groups slid ~640px from off screen | Rows clip out, rows below slide up (200ms); long moves fade out and back in at their new place | Short, readable motion |
| Staff numbers | Rolled with the gentle spring (~600ms) | Snappy spring (~250ms) | Staff stays under 300ms |
| Staff Homes | Brass door on every row's house | Pine door | Brass is for Keys |
| Insights chart (1024) | Home labels overlapped | Labels take the lowest lane that clears their neighbour | Readable |
| Staff at 390 | Console is a 1024px canvas | Kept: the spec makes the console desktop-only; phones can pan | Spec §2.B |
