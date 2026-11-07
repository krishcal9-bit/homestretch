# Decisions

Ambiguities resolved during the build, with the choice made.

- **Branch.** The spec (§0) asks for work on `main`; the session was set up on `claude/affectionate-tesla-sjf5ev`. Commits go to `main` as the spec asks, and the session branch is kept in sync with it.
- **Font loading.** `next/font/google` can't download font files in the build sandbox, so Public Sans is self-hosted via `@fontsource/public-sans`. Same typeface and weights, and it also works offline.
- **Prisma 6, not 7.** Prisma 7 needs driver adapters and a new config file. Prisma 6.19 keeps the classic SQLite setup and still supports `@prisma/adapter-libsql` for Turso.
- **apple-design references.** The skill's reference files (restraint checklist etc.) are not present in this environment; only its SKILL.md loaded. Its principles are applied from SKILL.md plus BUILD_SPEC §4.
- **One `Plan` table for families.** Seeded families and families who share their code are `sharedWithStaff = true`; a family's own saved plan stays private until shared (consent-first, §2.A.6).
- **Income tiers 5–8** are estimated at +7.5% per person compounded from the 4-person row, rounded to $50.
- **Tier boundaries** that appear in two tiers (e.g. $65,150) go to the higher tier.
- **Down payment target (deviation from §3).** The spec's 3% down + 2% closing on the maximum financeable price ($28k–$38k for seeded families) put every family 4–10 years out and contradicted the demo script ("19 months to 11"). The engine uses Habitat OC's 1% minimum down payment plus a flat $1,500 closing-cost estimate (`DOWN_PAYMENT_RATE`, `CLOSING_COSTS` in `lib/engine.ts`). Habitat staff should set these to their real numbers.
- **Ready date vs keys.** `monthsToReady` = max(credit, savings) = when the family is mortgage-ready to apply. Keys = that + 9-month build-and-close window. "Ready now" therefore means month 0.
- **Good credit with open collections.** A "good" band with listed collections waits for collections to clear (the spec defines "good" as no open collections).
- **Freed payments.** Each month, any debt budget not needed (because debts are paid off) rolls into savings. This keeps the extra-debt lever monotonic (more never makes the date later), which a "freed minimums at payoff" version broke.
- **Program cost (D6).** Matched savings cost is counted for each month until the family is ready (max 24); counseling is assumed at $100 per family per month of credit time saved; grants are per eligible family.
- **No temperature.** The current Anthropic Messages API (SDK 1.6) no longer accepts `temperature`, so the plan call omits the spec's 0.3. Output stays structured through the system prompt and Zod validation.
- **Default savings lever = $150/month.** The intake asks for savings on hand but not a monthly amount; starting at $0 put most families at 10+ years before they touch anything. The slider starts at $150 and the family moves it.
- **Landing page is a flagship surface (owner request).** It gets one orchestrated ~1.2s load sequence (headline lines rise blur-to-sharp, the sample Road draws, markers pop, the sample date rolls up) and one interactive element (an "Extra toward debt" slider on a fictional sample family that moves the Keys marker live). This overrides the original "only the Road animates on load" rule. Under reduced motion everything appears with a short fade. "How it works" stays static: no scroll-reveal choreography.
- **Staff sign in** is a quiet text link in the family header (top right on every family page); the staff login links back to the family site. One site, one URL.
- **Turso for production.** `lib/db.ts` switches to Turso through Prisma's libSQL driver adapter when `TURSO_DATABASE_URL` is set; `scripts/turso-setup.ts` creates the schema (from `prisma migrate diff`) and seeds. Verified by running the full e2e suite on the adapter path with a libSQL `file:` URL.
- **Landing redesign (owner spec, Nov 6).** `/` is now the flagship landing page; the intake moved to `/start`. The landing has its own ~1.4s load sequence and a scroll story; app screens keep utility-level motion.
- **View Transitions are hand-rolled** (`lib/vt.ts`, ~80 lines) instead of the `next-view-transitions` package, so each transition can carry a direction/kind (forward, back, start, result, fade) that CSS keys on. Browsers without the API, and reduced-motion users, fall back to Motion (intake) or an instant swap.
- **Road label layout** merges markers closer than 72px into one label and alternates labels above/below the track, flipping or merging until nothing overlaps. Keys and any highlighted milestone always keep their own label. Applies everywhere the Road appears.
- **Sample families on the landing page** (Reyes, Nguyen) are fictional and computed live by the same engine.
- **Build cache.** Repeated `next build` runs crashed inside the compiler with a `TypeError` until `.next/cache` (SWC/ESLint caches) was cleared; with two checkouts sharing `node_modules` the cache goes stale. `npm run build`, `npm run check` and the e2e server clear `.next/cache` first.
- **Round 4 intake illustrations (owner spec).** Each intake field that has an illustration (`components/illustrations/intake/`) gets one small, user-driven drawing: the household in front of the house, the Orange County outline, the coin stack, the scanned pay stub, the rent-share bar, the floor plan, the debt balance and the credit gauge. Nothing moves on its own; everything is ≤ 400ms except the 800ms pay-stub scan. A stepper is tapped many times in a row, so its number rolls on the Web Animations API (AnimatePresence "popLayout" injected a stylesheet and forced a full style recalc per tap), its ± press is a CSS `:active` scale, and screen blocks are memoized so a tap re-renders only that stepper and its drawing (4× CPU throttle: no frame over 34ms on the household stepper after the first tap). Debt tags weigh balances (estimated from the payment, like the engine) but show the number the family typed; past three debts the rest fold into "+2 more". "Overcrowded" uses the engine's rule.
- **Round 3 (owner spec).** First-session visits to `/` get the opening sequence (`components/landing/Opening.tsx`), with an inline pre-paint veil in `app/layout.tsx` so the page starts as blank paper; repeat visits in the session get the 1.4s hero sequence. `components/ui/Skyline.tsx` is the shared street (living on the landing page only; static elsewhere). The ticker is generated from the seed families and labelled "Sample families" — city and household size only, never names.
- **Round 4 (owner spec, Nov 7).**
  - **The intro plays on every load of `/`**, as asked. This replaces round 3's once-per-session opening, and `Opening.tsx` is removed. Tests and screenshot scripts skip it with `?nointro` or `sessionStorage hs.nointro`. Any click, wheel, touch or key skips it, and reduced motion gets a 150ms fade.
  - **The intro hands off by measuring the target, not with `layoutId`.** At 2.2s the intro reads the hero's Road track and Keys house positions and moves its ground line and house onto them with transforms. Motion's `layoutId` can't follow an element from an HTML overlay into an SVG inside the Road, and a measured move animates transform only.
  - **The intro is one timeline written as fixed delays from mount**, not a single `useAnimate` sequence. Each part is a declarative Motion element with its own delay, so a skip can unmount the whole overlay at once and leave nothing half-run. The spec's beats still hold: blueprint 0–0.6s, build 0.6–1.6s, key and door 1.6–2.2s, pull-back 2.2–2.8s.
  - **Arrow bob.** The down arrow bobs only on sections with no other ambient motion (scenes 1 and 2). The hero already has the lit window walking down the street, and scene 3 has the ticker. One ambient animation at a time.
  - **The ticker moved from under the hero into scene 3**, next to the neighborhood map. Hero sections are 100svh now, so it no longer fits under the hero, and it belongs with the homes.
  - **Dot rail only at ≥1280px.** At 1024 it overlapped the hero date. Below that, the arrows and keyboard do the same job.
  - **Keys label sits above the house.** The Road's Keys marker is now a small isometric house. Its label sits centered above the roof, outside the alternating label lanes, so nothing ever overlaps it.
  - **Sections reset when fully out of view.** Each section replays when it becomes active again. Its content clears once it has left the viewport entirely, so a return slides in clean and animates instead of popping from finished to blank.
  - **The hero does not replay on return**, so the visitor's slider position on the demo is kept.
  - **Section mounts are split across frames.** Activation waits for a programmatic scroll to settle and renders in a React transition. Text commits first and the illustration one frame later. This keeps every task under 50ms at 4× CPU throttle.
  - **Isometric house doors are brass only for Keys.** That covers the intro, the Road's Keys marker and the house at the end of the scene 2 road. Staff Homes rows draw the same house with a pine door.
- **Round 5 (owner spec, Nov 7): from outlines to rendered, dimensional objects.**
  - **The 3D house is code, not a model file.** `components/three/houseModel.tsx` builds a stylized two-story craftsman from primitives: lawn plinth, porch gable on posts, chimney, five framed windows, a brass door, a path, trees, a bush and a mailbox. Lighting is a hemisphere sky plus a warm directional sun with PCF shadows. A baked soft-shadow texture stands in for ambient occlusion. three.js 0.187 removed `PCFSoftShadowMap`, so we use PCF.
  - **Narrow-FOV perspective (20°), not orthographic.** It keeps a hint of depth while still reading as a product shot. The hero, result and plan slots all share one 5:4 framing (`SLOT_POSE`), so a single still render fits every slot.
  - **3D runs only on hardware-accelerated WebGL.** Chrome hands out SwiftShader without `failIfMajorPerformanceCaveat`, so software renderers are also detected by name (SwiftShader, llvmpipe, Basic Render Driver). On those, a live scene blocks the main thread for seconds; Lighthouse measured 132s of blocking time. They get `public/house/house.png` and the 2D title card instead. `?force3d` and sessionStorage `hs.force3d` force 3D for recordings in headless Chrome.
  - **The intro uses its own full-screen canvas, and the hero keeps its own slot canvas.** At the end, the intro camera is re-projected with a view offset so the house lands exactly on the hero slot, pixel for pixel. The hero canvas compiles under the overlay, renders one frame, then holds. The intro's WebGL teardown is deferred until the page is idle, because tearing down a context is a long task.
  - **The intro is anchored to the first 3D frame, not to page load.** The hero waits for the intro's hand-off signal and then plays its own sequence. If three.js hasn't drawn within 1.2s, the still version of the film plays on a shorter clock.
  - **Title card timing.** The owner asked for about 4.2s in total including the title, so the 3D build timeline runs at ×1.35: the door opens at about 1.9s. The title runs 1.95–3.75s and the hand-off 3.75–4.25s.
  - **The wordmark is outlines.** `scripts/build-wordmark.mjs` converts "Keystone" in Public Sans 600 at -0.03em into SVG paths using opentype.js. Each letter can then rise on its own from a mask and stays crisp at any scale. Blur-to-sharp is a crossfade between a pre-blurred copy and the sharp copy (opacity only).
  - **The wordmark's flight is a single Motion `layoutId` element.** The title copy unmounts in the same render as the header copy mounts, with no `AnimatePresence`. With a crossfade, the exiting copy flew back to the centre once the header dropped its `layoutId`.
  - **Brand name is "Keystone"** in titles, the footer, the closing band, referral packets and PDFs.
  - **The hero loses the line street.** The 3D house is the hero's visual now, and its chimney smoke is the one ambient loop. The slider warms the sun toward golden hour and lights windows as the date gets earlier.
- **Round 5 add-ons (owner, Nov 7): environments and a bigger title.**
  - **One fixed landing world.** The sky and horizon sit fixed behind every section rather than repeating per section, so it reads as one continuous place while sections slide over it. The horizon is richest at the edges and low in the middle, so content stays calm.
  - **Time of day without repainting.** It's a crossfade between an afternoon sky and a golden-hour sky (opacity only), driven by scroll progress.
  - **Parallax.** The layers lag mid-scroll and settle at rest (a triangle wave per section), then lean away from the cursor, capped at 16px at depth 1. They are compositor layers, and nothing moves under reduced motion.
  - **The hero's 3D house moved to stand on the world's street** (bottom of the first screen, slightly right of centre) instead of sitting beside the date. That's what makes it "belong to a place". It is positioned from the top of the first screen so its plinth always lands on the street.
  - **Phones crop the horizon to its calm centre.** That's the "reduced side scenery" without a separate artwork.
  - **The intake panel moved onto `--surface`.** The per-step neighborhood sits behind it at about 35% in the bottom third. Its blur is computed once; the one ambient cloud sits outside the blurred layer.
  - **On result and plan the scenery lives inside the Road panel (`RoadScene`), not page-wide.** The owner asked for the neighborhood behind the Road, and it keeps the rest of the page calm.
  - **Title card.** A 700-weight glyph set is generated alongside the 600 header set. The title itself flies onto the header's placeholder (a manual FLIP on one vector element) rather than using a Motion `layoutId`, because the two weights differ and a `layoutId` morph would snap from 700 to 600 mid-flight.
  - **The intro is now about 5.0s with 3D and 3.6s in the still version.** The owner's longer hold and flight supersede the earlier ~4.2s limit.

## Round 6 — hero product stage
- The hero's right 7 columns are one product stage (surface panel): the ready date, the 3D house standing on the
  Road's Keys end (`slotKind="stage"`, ~59% of the column; `pinKeys` keeps Keys at the road's end so the house
  never slides while dragging), then the slider. Phones (< 560px) stack date, house (~75% of the screen), Road,
  slider; the subline and buttons follow the stage so the house lands on the first screen.
- One canvas for the intro and the hero (`components/three/HeroHouse.tsx` + `StageScene.tsx`, store in
  `introStage.ts`). During the film the hero house's canvas is portaled onto the intro's stage; the camera lands on
  the slot through a view offset with the slot's own camera; at the end `dock()` moves the canvas element into the
  slot, resizes it and renders the slot frame in the same task. Verified on a frozen clock at 1440×900 and 390×844:
  the frames either side of the dock are identical over the house (edge anti-aliasing only).
- The slot framing was re-calibrated (SLOT_POSE target, EXTENT): ~9% air at the sides, chimney ~11% below the top
  (smoke rises less and fades inside that air), plinth base ~6% above the bottom; Road anchors moved to
  ax 0.38 / ay 0.785 (projected path end). `public/house/house.png` re-rendered with it.
- The intro's sky no longer fades back in when the title lands in the header (it flashed for ~50ms before).

## Round 6 — per-section landing scenes

- One shared backdrop (`components/scenery/World`) is gone from the landing. Each section has its own scene in
  `components/landing/scenes/`, full-bleed behind its content: hero street at late afternoon (neighborhood at the
  edges of the product stage, street along the bottom), a softly blurred kitchen behind the phone, a golden-hour
  valley whose winding road is the background and the car's exact path, an elevated block on a clean ground plane,
  a dusk street of a hundred homes. `SceneSky` is the landing's one fixed sky; it crossfades to the section the
  camera is headed to in 700ms (the new sky over the old, which drops only once covered: no dip).
- The camera move is scroll-linked parallax per layer (far 0.3–0.55, ground 1, foreground 1.15–1.28) relative to
  where the section rests, so arrows, dots, wheel and touch all read the same way. SectionNav gained a `target`
  (where the camera is headed: set when a move starts, or by the viewport's middle when scrolling freely).
- Ambient loops run only while the camera has settled on a section (`data-live`), never during a move. Scenes two
  or more sections away skip rendering (`content-visibility: hidden`); neighbours switch at rest. Large soft glows
  live in the sky layer (painted once) instead of in moving layers; no layer opacity fades (they forced offscreen
  passes in software compositing).
- Scenes take `night` (default false); everything that lights at night is its own `.sc-light` element with a stagger
  delay (`--d`), dark by day. Colours only from `P`/`mix()`; translucency only via opacity attributes.
- Perf at 4× CPU throttle in headless Chromium (software compositing, shared 4-core box) is measured with
  `scripts/perf-r6-scenes.ts`; the compositor's software draw, not the main thread, is the bottleneck there.

- **Round 6: light and dark mode (owner spec, Nov 7).** This supersedes "no dark mode" in BUILD_SPEC §4 and CLAUDE.md.
  - **One attribute drives everything.** `<html data-theme="light|dark">` is set by an inline `<head>` script before first paint (stored `hs.theme`, else `prefers-color-scheme`), so the wrong theme never flashes. With no stored choice the page follows the system setting live; another tab's choice syncs. The UI tokens and the illustration palette both key on it, so a switch is one attribute change with no React re-render. Canvases listen for the `hs:theme` window event (`{ theme, instant }`) or read `getTheme()`.
  - **Switching is a View Transition**, kind `theme`: the new theme fades in over the old snapshot (600ms, eased; the old stays opaque so nothing dips through transparency). The switch itself is excluded from the crossfade (its own `view-transition-name`) so its sun-to-crescent morph (250ms, transform/opacity) plays live. Lights in the scenery come on after the fade starts, 45ms apart (`.il-light`). Reduced motion or no View Transitions: instant.
  - **Dark tokens are the owner's values**, plus tokens the components needed: `--on-pine` (#0F1513: white on #4FA585 is 2.5:1), `--line-strong` (control borders), `--tip`/`--on-tip` (toast and Road tooltip: a raised dark grey at night, not an inverted light chip), `--band`/`--on-band` (the closing band: deep pine at night instead of a bright #4FA585 slab), `--knob`, `--selection`, `--scrim`, `--edge`, `--drawer-shadow`, `--scrollbar`, `--chart-base`.
  - **The illustration palette is CSS variables** (`P.wall === 'var(--il-wall)'`) with day and night values from one source (`PALETTE_CSS`, inlined in the layout head). Night is not inverted: a navy-to-ink sky, moonlit (darker, cooler) walls, roofs and lawns, warm lamplit glass, brass/honey/glow brighter. `P.ink` stays the darkest tone at night (tyres, phone bodies, shadows); text on paper uses `P.ink2`/`P.print`, which turn light with the paper. three.js, data-URI images and canvases take hex (`PX` day, `PN` night); `mix`/`alpha` return hex for hex and `color-mix()` for variables.
  - **The brand wordmark uses the UI tokens** (`--ink`, `--pine`), not the illustration palette: it is chrome.
  - **Data-URI textures are built twice** (`perTheme`) and CSS shows the current one (`.themed-bg`, `.theme-day-only/.theme-night-only`). The letter desk at night is dark walnut under a lamp; the sheet is dark paper with light ink.
  - **Night scenery** (components/scenery): stars and a moon (`.il-night`), moonlit clouds, most windows and porch lamps lit, the corner street lamp plus two lamps along the far sidewalk with pools of light; framing and roofing houses get a work light. Birds roost.
  - **The header's staff link hides below 640px** to make room for the switch. The staff console needs ≥1024px anyway, and the landing footer keeps the link.
  - **PDFs and the share card stay light**: they are drawn with their own hex and never read CSS variables.

## Keystone: get the keys, keep the keys (Keep mode)
- **Engine (lib/forecast.ts)**: escrow is re-analyzed at each insurance renewal (new premium/12 + the shortage —
  the premium jump, tax growth not yet collected, any supplemental bill — spread over 12 months); property tax +2%
  each July (CA fiscal year); HOA +5% each January; maintenance set-aside from the home's systems (sinking fund to
  each replacement + $40 small repairs; age-based default without systems).
- **Basic living** (non-housing needs, OC): $1,400 + $520 per extra person — an estimate, shown as such.
  **Tight** (amber) = breathing room below max($150, 4% of take-home); **short** (red) = below zero.
- **The set-aside jar**: the Shock Shield set-aside goes into a jar every month; the jar pays any rise above today's
  cost while it has money. Flattening is therefore monotonic by construction. It's honest: a permanently higher
  premium can't be saved away, so the band improves only as far as the family's margin allows (the spec's "band
  turns green" happens for families with room; for the tight Ramirez demo family the red month goes away).
  Recommended set-aside = the smallest amount that keeps every rise in the coming 12 months under $5.
- **Risk (staff)**: act now = breathing room below zero within 6 months, or tight plus a repair shortfall or missed
  check-in; watch = tight, a shock that cuts into the cushion (post-shock breathing < 1.5× tight line), or a system
  due within a year that savings can't cover. A missed check-in (>45 days) escalates but never flags alone.
- **Stress test**: missed payments a year assumed 3 (act now), 1 (watch), 0 (stable); dollars protected = avoided
  misses × the household's mortgage (the money that funds the next homes). A matched repair fund lowers the
  maintenance set-aside and covers repair shortfalls; a hardship fund starts the jar. Insurance up never makes
  anyone safer (tested). The headline is computed from the data, not hard-coded.
- **Sample homeowners live in code** (lib/seedHomeowners.ts, deterministic, renewals anchored to the current month):
  no new table, so production (Turso) needs no migration. A family's own Keep data stays on their device.
- **Tokens**: the spec's light `--signal-amber` #9A6B12 is 4.2:1 on paper (fails AA for body text); kept #8A5F0E.
- **Down payment** already 1% of the financeable price + $1,500 closing; 2026 tiers already in lib/incomeTiers.ts.
## Round 6 — one scene per section (the keep-the-keys story)

- Each landing section is one full-bleed place with its centrepiece drawn into it (components/landing/scenes):
  the shock (the family's monthly cost drawn across the kitchen wall; a March spike drops in; coins into a jar
  flatten it and turn the breathing room under it from amber to green), fix it early (a dollhouse view of the
  family's house; a savings meter on the garage wall fills and the aging water heater's amber glow calms to
  pine), Habitat sees it first (the early-warning block: Stable / Watch / Act now markers as text with a
  coloured rule, an outreach note flying to the home that needs a call), the dusk street ("Get the keys. Keep
  the keys."). The hero's scene is the lead's.
- No backdrop shared between sections: each SceneRoot renders its own sky, fixed to the viewport, crossfading
  with the neighbour's by the scroll (the incoming sky over the outgoing one, which stays opaque until covered).
- Night is the dark theme: P's night palette plus .sc-light / .sc-lamp elements; StreetLamp (parts.tsx) is the
  one lamp design, coming on 80ms apart along its street with a flicker on the first.
- Removed (unused after the pivot): RoadScene, PhoneVoice, JourneyRoad, HundredHouses, the hero ticker test line.

## Staff KEEP console (keep-5, keep-6, keep-10)
- **Staff home is Early warning** (`/staff`): the 40 sample homeowners sorted by risk (Act now, Watch, Stable; then the
  thinnest cushion in the next 6 months). The Ready pipeline moved to `/staff/ready` and gained a "Homes they fit"
  column (homes that fit the household and complete on or after the family's ready date). The Monday check-in for
  families stays at `/staff/checkin`, reached from the Ready pipeline.
- **One "Sample data" label** sits in the console bar (every household in the console is fictional).
- **Shock Shield moves are derived, never written by Claude** (lib/earlyWarning.ts `shieldMoves`): shop the renewal and
  ask for the wildfire (Safer from Wildfires) discount; file the Homeowners' Exemption ($7,000 off assessed value ≈
  $6/month at 1.06%); CARE/FERA when household income is under the CARE limit ($42,300 for 1–2 people, $53,300 for 3,
  +$11,000 each) or the FERA limit (households of 3+, ≈1.25× CARE); set aside the engine's `recommendedSetAside`; talk
  with Habitat. Done = in the household's `movesDone` (or the profile flag / current set-aside covers it).
- **Home Health "due soon"** = 2 years or less of typical life left.
- **Homeowner outreach** (`POST /api/outreach/homeowner`, `{ id, lang? }`): the server looks the household up and
  passes only engine numbers and the one next step (the first move not done). Spanish households get a Spanish note
  plus an English translation for staff. A model draft that drops the surname or runs over 120 words is replaced by
  the deterministic template. Approving logs a sample send to the console and shows a toast; nothing is sent.
- **Stress test**: "pushed out of Stable" compares each home under the scenario's shock with premiums and taxes held
  flat (0%, no supplemental). Defaults: 29% insurance (the FAIR Plan's 29.1% rounded), $150/month matched repair (so
  the funder headline opens on the case it is about), no hardship fund, no supplemental bills. The headline rounds
  dollars protected to the nearest $100 ("about $15,600"); the stat beside it shows the exact figure.
- **Weekly digest** (`POST /api/digest`, NDJSON): last week's snapshot is derived, not stored — the same household
  seven days ago with this week's fixed sample events undone (a take-home dip for five households, a finished move for
  four). A shock counts as new when it moved inside 90 days this week; a check-in counts as missed when it crossed 45
  days this week. Four households are drafted at a time, each streamed as it finishes. Rules template on any failure.
- Staff strings stay in English in the components, as in the rest of the staff console (staff work in English;
  families' notes are bilingual).

## KEEP extras: Home health, Relief, Check-in, the Ready bridge, the home plan PDF

- **Home health numbers are rules only.** Claude reads a data plate (system, manufacture year, confidence, a short
  description); age = this year − manufacture year, and the typical life and Orange County cost range always come
  from SYSTEM_DEFAULTS (lib/homeHealth.ts resolveSystem). Typed facts never call Claude. Photos are read in memory
  and discarded. One system per kind (a second water heater replaces the first; "something else" always adds).
- **The one monthly number** is lib/forecast maintenanceSetAside (each system's mid cost over its remaining life,
  at least 12 months, + $40 for small repairs). "Due now" systems therefore weigh heavily; that is the point.
- **Leak help shows the static safe checklist at once** and swaps in Claude's tailored steps when they arrive: in an
  emergency the safe steps must not wait on a model. A water-heater problem is never "can wait" (server floor).
- **Relief values are conservative and rules-made** (lib/relief.ts): Homeowners' Exemption $7,000 × 1% = $70/yr;
  CARE $420/yr and FERA $220/yr on a typical bill; CARE = 200% and FERA = 250% (3+ people) of the 2025 federal
  poverty guideline, labelled "2025 limits"; wildfire discount 5% of the premium ("many give more"). Claude only
  rewrites why / worth / next step, and the route drops any sentence carrying a dollar amount the rules didn't give.
- **Check-in answers apply immediately** (lib/keepCheckin.ts): a new premium also re-analyses escrow
  ((tax + premium) / 12, never lower than today); "something breaking" flags that system due within a year. SMS
  delivery is a mock: POST /api/keep-checkin logs each message to the server console; nothing is stored server-side.
- **POST /api/ready-plan** is the 90-day plan route; /api/plan re-exports it so saved clients keep working.

## Brand v2: Fraunces lockup and the cinematic load-in
- Wordmark: Fraunces (OFL) is used for the wordmark only. A subset of the variable font (just the letters of "Keystone", all axes, 8 KB) is self-hosted via next/font/local for the intro's live text. Static places (header, footer, staff, PDFs, share card) draw outlines generated from a static instance at opsz 144, wght 600, SOFT 30, WONK 0, with -0.02em tracking (`scripts/build-wordmark.mjs`), so the shapes match exactly after the flight into the header. The brass keystone notch at the top of the K's stem is a path, and it is the only flourish.
- The 28px header lockup leaves out the tagline: at 22% of the wordmark it would be about 5px. The tagline appears on the intro title card, in the PDFs and on the share card.
- PDFs and the share card draw the lockup from `lib/brandLockup.ts`, using hex colours with no masks, because react-pdf and satori can't run the React component. The keyhole is filled with the page colour.
- Load-in: one canvas and one clock (`FILM` in `components/introTimeline.ts`). The beats are: dusk and blueprint, the arch assembling, the keystone lock, the push through the arch to the street, and the name. The name lands at about 4.5s and holds for 1s; then the lockup flies to the header while the house lands on the hero slot, ending at 6.2s. Any input skips to the final hero with a 200ms fade. With reduced motion the hero fades in over 150ms.
- Cost: the ten pine stones are one merged mesh with per-stone transforms in a uniform array, giving one draw call plus one shadow pass. Dust and lamp halos are one Points object each, animated in the vertex shader. The light count never changes during the film, because a change would recompile every lit material. The film waits for `compileAsync` so no shader links mid-film. Once the film ends the frameloop is on demand.
- Depth of field is a CSS blur on the stage (a compositor animation), not a post-processing pass. The house waits in fog matched to the CSS sky until the camera comes through the arch.
- The arch leaves the frame as the camera passes through its opening. A vector arch then starts with its stones just outside the screen edges and closes in onto the lockup's icon, so the 3D and 2D arches are never on screen together.
- Without WebGL (or if three.js is late), the still version plays the same beats with the vector arch and the house still.
- Glows (joints, beam, lamp halos) use additive blending that leaves alpha untouched. The canvas is transparent over the CSS sky, and standard additive blending would write opaque black.

## Finish pass (landing)
- **Blank sections, the cause:** a section's text rendered only after the scroll landed and the section "activated"; on the live site the next section showed its scene with no headline for 2s or more. Now content is always rendered. A section's play count rises on the keypress (the target), so its reveal runs during the 800ms move. Scenes mount when the page is idle after first paint and stay mounted; neighbours within two sections keep rendering.
- **Header:** fixed on the landing. The landing's <main> leaves 64px for it. It is never inside a moving container.
- **Navigation:** a list of scroll stops: each section's resting place, plus one per stage of a pinned section (`data-stages`). Down/Up go stop to stop through Lenis (smooth wheel; touch is native). There is no CSS scroll-snap, which would fight Lenis.
- **Display type:** Fraunces for headlines (a 30 KB Latin instance at the wordmark's opsz 144 / SOFT 30, with a live weight axis), 72–96px, line masks. This overrides the earlier Public-Sans-only rule at the client's request. Body copy stays Public Sans, 18–20px.
- **The cost scene:** a pinned section of 400svh driven by scroll progress, with its own small canvas (frameloop on demand). The canvas mounts once and pauses off screen, because WebGL teardown was a 4s long task. Labels are DOM, placed every frame from projected 3D anchors and spaced apart per column. The numbers are a sample Habitat budget: mortgage $1,100, tax $325, insurance $237 (+29% ≈ +$69 at a FAIR Plan renewal), utilities $260, repairs $150.
- **Illustration:** one kit (components/illustrations/kit.tsx) for trees (palm, jacaranda, oak, cypress), hills, contact shadows and ground. Haze toward the sky colour gives atmospheric perspective. No SVG blur filters on large areas.
- **Hero:** the neighbours are parametric variants of the 3D model (ranch, townhome pair, colonial, cottage, foursquare) rendered as stills with the hero's camera. The Road's labels sit on plates on the verge.
- **THREE.Clock:** R3F 9.8 constructs it internally. A build-time webpack loader (scripts/loaders/r3f-clock.cjs) swaps in a Timer-backed clock; node_modules stay untouched.
- **axe:** text drawn over an illustrated scene (the dusk closing band) can't be measured by axe. Those nodes carry data-axe-scene-bg and are excluded; their contrast is measured from pixels instead (about 12:1).
