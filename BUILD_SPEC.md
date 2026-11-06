# Homestretch — Claude Code build prompt

You are building **Homestretch**, a hackathon web app for Habitat for Humanity of Orange County (Habitat OC), for the Claude Impact Lab hackathon at UC Irvine. The hackathon's brief: help Habitat OC reach 100 affordable homes for low-income families. Judges score five criteria equally: does it work, ease of implementation for the partner, impact on the partner's operations, creativity, teamwork. Build accordingly: every feature must demo live, run on a laptop, and be something a 10-person nonprofit could adopt next month.

## 0. Repository and Git workflow

This session is attached to the GitHub repository `krishcal9-bit/homestretch` (owner: https://github.com/krishcal9-bit). Work directly on the `main` branch, not a feature branch, so the Vercel deploy and the hackathon judges always see the latest code at the repo URL.

- Before the first commit, run `git config user.name "krishcal9-bit"` and `git config user.email "krishcal9@gmail.com"` in the repo.
- Commit and push to `origin main` at the end of every milestone in §7, with a message in the form `feat(step-4): result screen with Road and levers`. If a push is rejected, `git pull --rebase origin main` and push again; never force-push.
- Add a `.gitignore` for Node/Next (`node_modules`, `.next`, `.env`, `*.db`, `playwright-report`) before the first commit. Commit `.env.example`, never `.env`.
- Put screenshots in `docs/screenshots/` and commit them; the README links to them.
- Create a `CLAUDE.md` at the repo root in step 1 that summarizes §3, §4, and §7 of this document in under 60 lines, so every future session in this repo follows the same engine rules, design tokens, and build order.
- Tag the final commit `v0.1-hackathon`.

Read this whole document before writing any code. Then work in the order given under "Build order."

**Work autonomously from start to finish.** Do not stop to show me screenshots, ask for approval, or check in between milestones. Take screenshots for your own review only: look at them, fix what's wrong, and keep going. If something is ambiguous, pick the most reasonable option, note it in `docs/DECISIONS.md`, and continue. Only stop early if you are completely blocked (for example, a missing secret), and say exactly what you need. When everything in §7 is done, send me one final message with: the live URL (see §6 deploy), the staff password, a 10-line list of what was built, anything you cut and why, and known issues. I will test it myself and send back bugs.

---

## 1. The problem, precisely

Habitat OC sells homes to working families with an affordable mortgage. To qualify, a household must:

- Have a **need**: overcrowded/unsafe housing, or housing costs over **30% of gross monthly income**, and be unable to buy at market rate.
- Have **steady, verifiable income** inside a tier for their household size (2026 figures from habitatoc.org/review-qualifications). Put this table in `lib/incomeTiers.ts`:

| Household | Very Low | Low | Moderate |
|---|---|---|---|
| 1 | 39,100–65,150 | 65,150–104,200 | 104,200–116,400 |
| 2 | 44,700–74,450 | 74,450–119,100 | 119,100–133,050 |
| 3 | 50,300–83,750 | 83,750–134,000 | 134,000–149,650 |
| 4 | 55,850–93,050 | 93,050–148,850 | 148,850–166,300 |
| 5–8 | extrapolate +~7.5% per person from the 4-person row; mark as estimated in a code comment |

- Be a **US citizen or permanent resident** who **lives or works in Orange County**.
- Have **credit in good standing** (no fixed score published; treat ≥ 640 with no open collections as "good", 580–639 as "building", < 580 or open collections/recent bankruptcy as "needs work").
- Be able to carry a **long-term mortgage** and bring **1–5% down payment plus closing costs**.
- Contribute **sweat equity** hours and attend an **orientation** before applying.

Habitat's operational pain, which the staff dashboard must solve:
1. Families attend orientation, don't qualify yet (usually credit or savings), get referred out to SparkPoint OC / Operation HOPE, and **disappear**. Nobody tracks when they'd be ready.
2. Staff verify income by hand from pay stubs and bank statements.
3. Habitat has a build pipeline (homes finishing on known dates) but no view of **how many families will be mortgage-ready when each home is done**.

Homestretch answers: "How far is this family from keys, what exactly closes the gap, and which upcoming home can they realistically get?"

---

## 2. Product: three surfaces

### A. Family app (mobile-first, `/`)
A guided intake that feels like Better.com's mortgage pre-approval flow, not a form. One question group per screen, big tap targets, progress shown as a thin bar at the top, back button always present. Spanish/English toggle in the header on every screen, and the toggle re-renders all static copy from a `messages/{en,es}.json` dictionary (no machine translation for UI; Claude only translates generated content).

Screens, in order:

1. **Welcome** — one sentence: "See how close you are to a Habitat home, and exactly what to do next." Secondary line: "Takes about 4 minutes. Nothing is sent to a credit bureau." Single primary button: "Start". Below, a quiet row: "Already have a plan? Open it with your code."
2. **Household** — household size (stepper 1–8), live or work in Orange County (yes/no), citizen or permanent resident (yes/no). If either answer is no, do not block; show an inline note that Habitat OC requires it and continue (staff want to see these too).
3. **Income** — gross monthly income from work, plus a toggle "Add other income" (child support, second job, benefits). Show the annual figure updating live under the field. Then a card: **"Scan a pay stub instead"** — camera/file upload. On upload, send the image/PDF to Claude (vision) and extract `{ employer, payFrequency, grossPerPeriod, ytdGross, payDate }`, compute monthly gross, and pre-fill the field with a small "From your pay stub · Edit" tag. Keep the manual path fully working; the scan is an accelerator.
4. **Housing now** — monthly rent, number of bedrooms, number of people sleeping there (to compute overcrowding: > 2 per bedroom), checkbox for "unsafe or unhealthy conditions".
5. **Money picture** — monthly debt payments (car, credit cards, student loans, other, each optional), total savings available for a home, credit standing (segmented control: "Good", "Building", "Needs work", "Not sure"). Then card: **"Upload a bank statement for a sharper plan"** — optional. If uploaded, Claude reads the statement and returns `{ recurringDebts[], rentPaymentDetected, avgMonthlyDeposits, overdraftOrNsfCount, largeUnexplainedDeposits[] }`. Use it to pre-fill debts and to drive the "Underwriter's eye" section later. State clearly: "Your file is used once to fill in this form and is not stored."
6. **Result: your path to keys** — the hero screen. See §4 for the exact design. Contents:
   - The **ready date** in large type (e.g., "August 2027") with one line under it: "about 10 months from today, if the plan below holds."
   - The **road**: a horizontal timeline from Today to Keys with milestone markers placed proportionally by month: "Collections cleared", "Credit at 640", "Down payment saved", "Orientation", "Application", "Keys". Hover/tap a marker for the one action that unlocks it.
   - **Three levers** (sliders) directly below the road: "Extra toward debt each month" (0–$500), "Savings each month" (0–$1,000), "Add a co-applicant income" (0–$3,000/mo). Dragging a slider recomputes the engine instantly client-side and the ready date and markers move. This is the wow moment; make it buttery (requestAnimationFrame, no layout shift).
   - **Why this date** — the engine's reasoning as 3–5 plain sentences, each tied to a number ("Your rent is 41% of income, which qualifies as need." "A $2,400 collection is the first thing to clear; at $150/month that's 16 months, so we front-load it.").
   - **Underwriter's eye** (only if a statement was uploaded) — things a lender will notice, phrased kindly and specifically: overdrafts in last 90 days, cash deposits that will need a letter of explanation, a recurring payment that looks like an unlisted loan. Each with "What to do".
   - **Your 90-day plan** — Claude-generated, structured, max 6 actions, each with a who/what/by-when and a local resource where relevant (SparkPoint OC for credit counseling, Operation HOPE, Habitat OC orientation signup). Render as a checklist the family can tick; persisted.
   - **What Habitat could finance** — a small panel: max affordable payment = 30% of gross monthly income; at Habitat's typical 0% interest 30-year note, show the home price that payment supports (price = payment × 360). Compare to current rent in one sentence: "That's $220 less than you pay now."
   - **Save my plan** — generates a 6-character code and a magic link; shows "Text me this" (mock, logs to console) and "Download PDF". The PDF is a clean one-page summary with the road, the date, and the 90-day plan, in the chosen language.
   - Final line: "Habitat OC staff can see your plan only if you share your code at orientation." (Consent-first; default is private.)

### B. Staff console (desktop, `/staff`, password gate via `STAFF_PASSWORD` env)
Reference the restraint of Mercury's dashboard and the density of Linear. No marketing feel; this is a work tool.

1. **Pipeline** — a table (not Kanban cards) grouped by stage: *Ready now*, *Ready in ≤ 6 months*, *Ready in 6–18 months*, *18+ months*, *Not eligible (why)*. Columns: Family (surname, household size), Tier, Ready date, Biggest blocker, Last activity, Plan code. Row click opens a right-side drawer with the family's full road and plan. Filters along the top as text chips: tier, blocker type, language, stage. A single search box.
2. **Homes** — Habitat's upcoming homes (seed 8: address, city, bedrooms, projected completion date, status). For each home, show the count of families projected ready by that date whose household size fits the bedrooms. This is the operational insight: "Costa Mesa 3BR, done March 2027: 6 families projected ready, 2 ready now."
3. **Match** — select a home; the app ranks families by fit (household size vs bedrooms, readiness by completion date, tier). For each candidate: a one-line Claude-written "why this match" and a button "Draft outreach" that writes a bilingual check-in email or text to the family with their single next action. Staff edit and copy; nothing is sent automatically.
4. **Insights** — four numbers across the top (families tracked, projected ready within 12 months, median months to ready, most common blocker), then one chart: a bar chart of families by projected-ready month for the next 24 months, with the upcoming homes' completion months marked on the same axis as thin vertical lines. That single chart is the slide Habitat's director would show their board. Use Recharts with the palette in §4; no gridlines beyond faint horizontals, no legend if labels are obvious.

### C. Shareable plan (`/plan/[code]`)
Read-only view of a family's road and plan, mobile-first, same hero as the result screen, with the checklist editable by the family. This is what the magic link and PDF point to.

### D. Stand-out features (these are what win; build them in the order listed in §7)

**D1. Pick a home (reverse goal-seek).** On the result screen, a panel "Aim for a specific home" lists Habitat's upcoming homes that fit the household size (from the Homes table). Tapping one runs the engine backwards: binary-search the monthly savings and extra-debt levers until `readyDate ≤ home.completionDate`, then show "To be ready for the Costa Mesa 3-bedroom by March 2027, you'd need to put $310 toward debt and save $420 a month. That's $140 more than you do now." If no lever combination gets there, say so and show the earliest home that works. The sliders snap to the solved values so the family sees the road re-draw. Implement in `lib/engine.ts` as `solveForDate(profile, targetMonth)`, pure and tested.

**D2. Two futures.** Below the finance panel, one chart titled "Ten years from now": two lines, "Keep renting" (rent grows 4%/yr, equity stays $0) and "Habitat home" (fixed Habitat payment, equity grows by principal paid at 0% interest, home value grows 3%/yr). Y-axis is cumulative housing cost; a second number below the chart shows equity at year 10. The sentence under it is generated by the engine, not Claude: "Over ten years, renting costs $X more and leaves you with $0. The Habitat home leaves you with $Y in equity." Recharts, two lines, pine for Habitat, ink-2 for renting, no fill, no legend box; label the lines at their right ends.

**D3. Talk instead of type.** On every intake screen, a microphone button next to the title. Uses the browser's Web Speech API (`webkitSpeechRecognition`, language follows the toggle: `en-US` / `es-US`). The transcript is sent to `POST /api/parse-speech` with the current screen's field schema; Claude returns the fields as JSON and the form fills in with a 200ms highlight on each filled field. A family can say "somos cuatro, vivimos en Santa Ana, gano como cinco mil al mes" and watch the form complete. If the browser lacks the API, hide the button. Fallback for the demo: a text area labelled "or type what you'd say".

**D4. Letter of explanation.** For each Underwriter's-eye flag that lenders require an explanation for (cash deposits over $1,000, employment gaps, overdrafts), a button "Write my explanation letter". Claude drafts a one-paragraph letter in the family's language in the format lenders expect (date, lender, re: line, explanation, signature line), pre-filled with the specific amount and date from the statement. The family edits inline and downloads as PDF. This is a real artifact every Habitat applicant eventually needs.

**D5. Counselor handoff.** On the result screen, "Send my plan to a counselor". Generates a one-page referral packet PDF for SparkPoint OC or Operation HOPE: household summary, the three blockers in priority order, the engine's timeline, and what Habitat needs to see at the end. Mock the send (log to console, show "Sent to SparkPoint OC" toast). For staff, the same packet is attached in the family drawer. This closes the "families disappear after referral" gap directly.

**D6. Program simulator (staff → Insights).** A panel "What if Habitat funded a program?" with three toggles and a number input each: matched savings ($ per family per month), credit counseling that shortens the credit milestone by N months, and a down-payment assistance grant ($ per family). Toggle any of them and the readiness-by-month chart re-renders with a second series showing the new projection, plus the headline "12 more families ready by December 2027, for $48,000." All engine math, instant. This is the slide a Habitat director takes to a funder, and it comes straight from the same `engine.ts`.

**D7. Monday check-in agent (staff).** A button "Run Monday check-in" in the Pipeline header. Server-side, iterate every tracked family: recompute readiness with any checklist items they've ticked since last week, detect changes (milestone reached, stalled 30+ days, newly matches a home), and have Claude write a 3-line digest per family that changed plus a draft nudge in the family's language. Render as a digest page with "Approve and queue" per item; nothing sends. Show progress as it runs (streamed, family by family). Seed data must include enough variety that the demo produces at least 5 changed families.

**D8. Share card.** After saving a plan, "Share your progress": a generated 1080×1920 image (Next.js `ImageResponse` in `app/api/card/[code]/route.tsx`) with the road, the ready date, and "I'm 11 months from keys" in the family's language, Habitat OC's name, no personal financial numbers. Downloadable; families post it, Habitat gets organic reach.

Cut order if time runs short: D8 → D7 → D3 → D5 → D4 → D6. Never cut D1 or D2.

---

## 3. The readiness engine (`lib/engine.ts`) — deterministic, unit-tested

Pure TypeScript, no LLM. Input is the full profile; output is `ReadinessResult`. Claude only explains and plans around the engine's numbers; it never produces them.

```ts
type Profile = {
  householdSize: number; inOC: boolean; residentOrCitizen: boolean;
  grossMonthlyIncome: number; otherMonthlyIncome: number;
  rent: number; bedrooms: number; occupants: number; unsafeConditions: boolean;
  debts: { kind: 'car'|'card'|'student'|'collection'|'other'; balance: number; minPayment: number; apr?: number }[];
  savings: number; creditBand: 'good'|'building'|'needs_work'|'unknown';
  creditScore?: number; openCollections?: number;
  levers: { extraDebt: number; monthlySavings: number; coApplicantIncome: number };
  statement?: StatementFindings;
};

type Milestone = { key: 'collections'|'credit'|'savings'|'orientation'|'application'|'keys'; month: number; label: string; action: string };

type ReadinessResult = {
  eligible: { need: boolean; income: boolean; residency: boolean; reasons: string[] };
  tier: 'very_low'|'low'|'moderate'|'below'|'above';
  costBurden: number;                 // rent / gross monthly
  overcrowded: boolean;
  dti: number;                        // monthly debt payments / gross monthly
  maxPayment: number;                 // 0.30 * gross monthly
  financeableHome: number;            // maxPayment * 360 (0% Habitat note)
  downPaymentTarget: number;          // 3% of financeableHome + 2% closing, rounded to $100
  monthsToReady: number;
  readyDate: string;                  // ISO month
  milestones: Milestone[];
  blockers: { key: string; severity: 1|2|3; text: string }[];
  score: number;                      // 0–100, explained below
};
```

Engine rules:
- **Tier**: from the table, using `(grossMonthlyIncome + otherMonthlyIncome + levers.coApplicantIncome) * 12`.
- **Need**: `costBurden > 0.30 || overcrowded || unsafeConditions`.
- **Debt timeline**: pay collections first (they block "good standing"), then highest-APR card. Monthly amount available = sum of minPayments + `levers.extraDebt`. Simulate month by month with APR (default 24% cards, 8% car, 6% student, 0% collections) until collections are zero and card utilization < 30% of inferred limits (assume limit = balance / 0.9 if unknown). That month = `collections` milestone (if any) and feeds the credit milestone.
- **Credit milestone**: if band is good → month 0. Building → max(debt timeline month, 6). Needs work → max(debt timeline month + 6, 12). Unknown → treat as building but add a blocker "Pull your free report at annualcreditreport.com this week".
- **Savings milestone**: months until `savings + monthlySavings * m ≥ downPaymentTarget`, where `monthlySavings = levers.monthlySavings` plus, after debts are paid, the freed minPayments roll into savings automatically (show this in "Why this date").
- **Orientation**: `max(credit, savings) - 2` clamped ≥ 0 (attend before fully ready). **Application**: orientation + 1. **Keys**: max(application + 9, credit + 9, savings + 9) (9 months is a typical Habitat build-and-close window; comment it).
- **Score**: 100 − 4 × monthsToReady (floor 5), minus 25 if any eligibility `false`, plus 5 if a statement was uploaded with zero overdrafts. Clamp 0–100. Show the score only to staff; families see the date, not a score.
- Levers recompute everything; the function must run in < 2 ms so sliders feel instant.
- `solveForDate(profile, targetMonth)`: binary search over `monthlySavings` (0–1500) and `extraDebt` (0–800) jointly, preferring the split that minimizes total extra dollars per month; return `null` if unreachable with both maxed.
- `tenYearComparison(profile)`: arrays of 10 yearly points for renting vs Habitat as described in D2.
- `simulateProgram(families[], program)`: applies matched savings / counseling / grant to every family and returns the new ready-month histogram and cost.
- Write Vitest tests for: tier boundaries, cost burden, a collections-first case, a "ready now" case, lever monotonicity (more extra debt never makes the date later), `solveForDate` hitting the target month exactly and returning null when impossible, and `simulateProgram` never making anyone later.

---

## 4. Design system — read this carefully; it is the difference between winning and looking like every other AI demo

**Load the `/apple-design` skill first.** Before writing any UI code (build-order step 1, and again at the start of steps 4, 7 and 13), invoke the `apple-design` skill with the Skill tool and follow it. If it isn't in your skill list, tell me right away and continue with this section alone. How the skill and this section fit together:

- **The skill governs behavior and restraint.** Use it for interaction logic (loading, empty, error states, perceived performance), motion (spring-based, interruptible, ≤300ms on utility screens, `prefers-reduced-motion`), 44px minimum touch targets, layout that reflows instead of truncating, and its restraint checklist. Every screen in this app is a **utility surface** in the skill's terms, so no cinematic or scroll-driven effects. The one exception is the Road draw-in described below.
- **This section governs identity.** Keep the color tokens, Public Sans, the single brass accent and the no-shadow rule exactly as written here. Do not switch to the system font stack, add Liquid Glass or translucency to panels, add gradient text, or use a dark theme. The skill itself says glass belongs on chrome only and color is the replaceable part; here, that part is replaced by these tokens.
- **The skill's checks run on every screen.** Ask its question for each effect ("remove it: does the design lose meaning or just decoration?") and cut whatever is only decoration. In step 13 add a pass in `docs/QA.md` titled "apple-design restraint check" listing what you removed.

### 4.1 Motion and craft: make it feel built by a senior product designer

The goal is an app where everything feels physical, quick and intentional, the way Linear, Stripe Dashboard, Things 3 and Apple's own apps feel. Smoothness comes from consistency and from motion that explains change. It doesn't come from adding more animation.

**Library and setup**
- Use **Motion** (`motion/react`, the package formerly called Framer Motion) for all component animation. Use CSS transitions only for color and opacity hover states. No other animation libraries.
- Create `lib/motion.ts` with the shared tokens below and import them everywhere. No component may define its own duration or easing.

```ts
export const spring = {
  snappy: { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 },  // buttons, toggles, chips
  smooth: { type: 'spring', stiffness: 260, damping: 30 },              // panels, drawers, layout shifts
  gentle: { type: 'spring', stiffness: 140, damping: 22 },              // numbers settling, Road markers
};
export const ease = { out: [0.22, 1, 0.36, 1], inOut: [0.65, 0, 0.35, 1] };
export const dur = { micro: 0.12, short: 0.2, medium: 0.32, long: 0.9 }; // seconds
export const stagger = 0.04;
```

- Wrap the app in `<MotionConfig reducedMotion="user">` so every animation respects `prefers-reduced-motion` automatically. With reduced motion on, things change instantly or crossfade in ≤100ms, and nothing slides.

**The signature moments (build these exactly)**
1. **The Road entrance** (result screen, once per visit). Draw the track over `dur.long` with `ease.out`, then milestone markers scale in from 0.6 to 1 with `spring.gentle` and `stagger` 60ms, then the ready date rolls in. This is the one place time is spent for effect.
2. **Rolling numbers.** Every money figure and the ready date animate between values, never jump. Build one `<AnimatedNumber>` component using `useSpring` (`spring.gentle`) plus `Intl.NumberFormat`, with tabular numerals so digits don't shift width. For the date, crossfade month names vertically (old moves up 8px and fades, new comes in from 8px below) over `dur.short`.
3. **Sliders that feel physical.** The thumb grows from 20px to 24px on press (`spring.snappy`). Road markers follow the value with `spring.gentle` on every frame, never on release. The filled track follows instantly. When the ready date crosses a month boundary, give a single subtle `navigator.vibrate(8)` on supported phones.
4. **Pick a home (D1) solve.** When a home is chosen, the sliders animate to their solved positions with `spring.smooth` over about 600ms while the Road re-flows. This should look like the app is working the problem out in front of you; it's the demo's best moment.
5. **Intake screen transitions.** Screens slide horizontally 24px and crossfade (`spring.smooth`), forward to the left and back to the right, using `AnimatePresence mode="popLayout"`. The progress bar at the top fills with `spring.smooth`, so the whole flow reads as one continuous journey.
6. **Staff drawer.** Slides from the right with `spring.smooth`, a backdrop fades to 20% ink, and the content inside staggers in at 30ms per section. On close everything reverses.
7. **Monday check-in stream (D7).** Each family row enters with a 12px rise and fade as it streams in; the counter at the top rolls up with `<AnimatedNumber>`.
8. **Charts.** Bars and lines grow from the baseline on first view (`dur.medium`, staggered 20ms). When the program simulator changes the data, existing bars morph to their new heights with `spring.smooth`. Never redraw from zero.

**Micro-interactions (apply consistently)**
- Buttons: press scales to 0.97 with `spring.snappy`; hover darkens the fill by one step over 120ms. No hover lift and no shadow on hover.
- Toggles, chips and segmented controls: the selected background is one shared `layoutId` element that glides between options.
- Checklist items: the checkmark draws as a path over 200ms, the row text fades to `--ink-2`, and the item never jumps position.
- Inputs: the focus ring fades in over 120ms. A field filled by pay-stub scan or voice gets a 600ms background pulse in `--pine-soft` that fades out.
- Copy or save confirmations: a small toast slides up 8px from the bottom with `spring.snappy` and leaves after 2.4s. The toast text uses the same verb as the button ("Plan saved" after "Save my plan").

**Loading and perceived speed**
- Anything under 300ms shows no loading UI. 300ms to 1s: the trigger button shows an inline spinner and keeps its width. Over 1s: show a skeleton that matches the real layout (same heights, `--line` color, a slow 1.6s shimmer).
- Claude-generated text (plan, letters, outreach) streams in token by token and the container grows with a `layout` animation. Never pop a finished block in after a spinner.
- Use optimistic UI for checklist ticks, approvals and plan saves: update instantly and reconcile in the background.

**Craft details a professional designer would check**
- Use one icon set (Lucide, 1.75 stroke) and an 8px spacing rhythm. Optical alignment: icons next to text are nudged so they look centered, not just measured centered.
- No layout shift anywhere. Reserve space for images, numbers and error messages. Check with Lighthouse CLS < 0.02.
- Empty, loading, error and success states are designed for every screen, not left as defaults.
- Hit areas are at least 44px even when the visible control is smaller.
- Text never touches a container edge. Minimum 16px inner padding on panels and 12px in table cells.
- No animation runs on page load except the Road. Nothing loops. Nothing bounces on its own.
- Frame rate: animate only `transform` and `opacity`. Test the Road and slider on a throttled CPU (Chrome DevTools 4× slowdown) and keep it at 60fps; if it drops, simplify.

**Verify it.** At the end of steps 4, 7 and 13, record a 10-second screen capture of the main interaction (Playwright `video: 'on'`) and look at it frame by frame. Fix anything that stutters, overshoots awkwardly, or moves without a reason. Add the clips to `docs/motion/`.

**Positioning.** Civic, calm, and financially literate. Think Copilot Money's clarity with numbers, Better.com's one-question-at-a-time flow, Mercury's quiet dashboard, and the plain-language confidence of the US Web Design System. It should feel like a credit union that actually likes you.

**Do not use**: cream/beige backgrounds with terracotta accents; near-black backgrounds with neon; identical rounded cards with the same drop shadow everywhere; gradient washes; all-caps eyebrow labels; "01 / 02 / 03" numbering; arrows "→" in button text; emoji; glassmorphism; a monospace font for numbers or labels; "Powered by AI" badges or sparkle icons anywhere. Numbers are the hero; the UI gets out of their way.

**Color tokens** (CSS variables in `globals.css`, Tailwind extended):
- `--paper: #F6F7F5` page background (cool off-white, not cream)
- `--surface: #FFFFFF` panels
- `--ink: #182420` primary text
- `--ink-2: #4A5753` secondary text
- `--line: #DDE3DF` hairline borders
- `--pine: #1E5C47` primary action, links, progress fill
- `--pine-soft: #E4EFEA` tonal background for selected states
- `--brass: #B8862B` one accent only: the ready date, the "Keys" marker, and the current position on the road. Nowhere else.
- `--signal-red: #B3362B`, `--signal-amber: #9A6B12` for underwriter flags, used as text color with a 2px left rule, never as filled badges.
- Dark mode: skip it. One well-executed light theme.

**Type.** One family: **Public Sans** (Google Fonts), weights 400/500/600. Tabular numerals everywhere money or dates appear (`font-variant-numeric: tabular-nums`). Scale: 13/15 for helper text, 16/24 body, 20/28 section titles, 28/34 screen titles, and one display size 56/60 weight 600 reserved for the ready date and the four Insights numbers. Letter-spacing −0.01em at 28+, never tracked-out caps. Line length ≤ 70 characters.

**Shape and depth.** Border radius 8px on inputs and buttons, 14px on panels. No shadows; separation comes from `--line` hairlines and `--paper` vs `--surface` contrast. The only elevated element is the staff drawer (shadow `0 12px 40px rgba(24,36,32,0.12)`).

**Spacing.** 4px base grid. Page gutters 20px on mobile, 32px on desktop. Family app max width 560px centered; staff console max width 1280px, left-aligned content.

**Motion.** See §4.1. One orchestrated entrance (the Road), and every other animation answers something the user did.

**The road component** (`components/Road.tsx`): an SVG, full width, a 3px `--line` track with a `--pine` fill from Today to current month, markers as 10px circles (`--surface` fill, 2px `--pine` stroke; the Keys marker is `--brass` filled with a small key glyph drawn in SVG, not an icon library). Labels under the markers, staggered on two lines to prevent overlap, 13px `--ink-2`. On mobile the road scrolls horizontally inside a container with a faint fade at the right edge. Markers are keyboard-focusable with a tooltip.

**Inputs.** Currency fields show a leading "$" inside the field, format with thousands separators on blur, and accept pasted "$2,400.00". Steppers for household size. Segmented control for credit standing. Every input has a visible label above it, in sentence case, and helper text below only when it adds information ("Before taxes. Include tips and overtime if steady.").

**Copy voice.** Sentence case everywhere. Active verbs on buttons that say what happens: "See my path", "Save my plan", "Draft outreach", "Open plan". No "Submit", no "Get started". Errors say what to do: "Enter your rent to continue." Empty staff states say what to do: "No families yet. Share the family link at the next orientation."

**Icons.** Lucide, 18px, stroke 1.75, only where they replace a word (upload, back, search, close). No icon beside every heading.

**Accessibility floor.** Contrast ≥ 4.5:1 for text, visible 2px `--pine` focus rings, every slider has a labelled number input twin, forms navigable by keyboard, all images have alt text, language attribute switches with the toggle.

Before calling any screen done, screenshot at 390×844 and 1440×900 and compare against this section. If it looks like a generic SaaS template, change it.

---

## 5. Claude usage (server-side only, `app/api/*` route handlers, Anthropic SDK, model `claude-sonnet-5-5`)

- `POST /api/extract/paystub` — vision; returns the JSON shape in §2.A.3. Use a system prompt that insists on returning only JSON and `null` for unreadable fields.
- `POST /api/extract/statement` — vision/PDF; returns `StatementFindings`. Never store the file; process in memory and discard.
- `POST /api/plan` — input: `Profile + ReadinessResult + language`. System prompt includes Habitat OC's rules from §1 and the local resources. Output JSON: `{ whyThisDate: string[]; actions: { title; detail; owner: 'you'|'habitat'|'counselor'; byMonth: number; resource?: { name; url } }[]; underwritersEye?: { finding; whatToDo }[] }`. Max 6 actions. Temperature 0.3. Validate with Zod; on failure retry once, then fall back to a rules-based plan so the demo never breaks.
- `POST /api/outreach` — input: family summary + home + language; returns `{ subject; body }` in a warm, plain voice, under 120 words, with exactly one next action.
- `POST /api/match-reason` — one sentence per candidate.
- `POST /api/parse-speech` — input: transcript, language, Zod schema of the current screen's fields; output: partial field object. Numbers must come back as numbers ("cinco mil" → 5000).
- `POST /api/letter` — input: one Underwriter's-eye finding + family details + language; output `{ letter: string }` in standard lender LOE format.
- `POST /api/checkin` — streams NDJSON, one line per family that changed: `{ familyId, change, digest, nudge }`.
- Cache plan output per `(profileHash, language)` in SQLite so sliders don't re-call Claude; only "Regenerate plan" does.
- Log every Claude call's purpose and token count to the console for the demo.

---

## 6. Stack and project rules

- Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui only for Dialog, Drawer, Tooltip, Select (restyle to the tokens; strip default shadows), Recharts for the one chart, `@anthropic-ai/sdk`, Prisma + SQLite, Zod, Vitest, Playwright for screenshots, `motion` (Motion for React) for animation, `@react-pdf/renderer` for the plan PDF, `next-intl` or a tiny custom dictionary for en/es.
- `.env.example` with `APP_ANTHROPIC_API_KEY`, `STAFF_PASSWORD`, `DATABASE_URL`. The key is deliberately NOT named `ANTHROPIC_API_KEY`: the Claude Code cloud environment strips that name. Create the client as `new Anthropic({ apiKey: process.env.APP_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY })` in `lib/claude.ts`, and nowhere else.
- `prisma/seed.ts`: 14 realistic Orange County households (Santa Ana, Anaheim, Garden Grove, Costa Mesa, Westminster), varied household sizes, 5 Spanish-preferring, a spread of readiness from "ready now" to "30+ months", 2 not eligible (one over income, one outside OC); and 8 upcoming homes with completion dates spread over the next 24 months. Names plausible, no real people.
- `README.md`: what it does in 5 lines, architecture diagram (Mermaid), how Claude is used (table of the five calls), how the engine works, setup in 4 commands, demo script (below), and a "What Habitat OC would need to adopt this" section (hosting cost, data policy, Spanish review).
- Deploy target: Vercel, connected to the GitHub repo so every push to `main` deploys. Use Prisma with SQLite locally; for Vercel, switch `DATABASE_URL` to a Turso (libSQL) URL via the `@prisma/adapter-libsql` adapter, or fall back to a JSON file store under `/tmp` if that takes more than 20 minutes. Do not let deployment block the demo; local is fine.
- Push to `origin main` after each milestone, as described in §0.

---

## 7. Build order (do not reorder)

Each step ends with: `npm run check` green (see §9), a Playwright screenshot committed to `docs/screenshots/`, a commit, a push. If a step's checks fail, fix them before starting the next step. Never start a new feature on a red build.

1. Scaffold, tokens, fonts, layout shell, language toggle, seed script, `npm run check` wired up. Screenshot the empty shell.
2. `lib/engine.ts` with all four functions + tests passing.
3. Family flow screens 1–5 with manual entry only. Persist profile in localStorage as the user goes.
4. Result screen with the Road, levers, "Why this date", finance panel, **D1 Pick a home**, **D2 Two futures**. All client-side from the engine. Screenshot; this is the demo centerpiece, polish it.
5. `/api/plan` and the 90-day checklist. Save plan + code + `/plan/[code]`. First Playwright e2e test (§9) passes here.
6. Pay stub and bank statement extraction with graceful fallback when no file. **D4 Letter of explanation.**
7. Staff: gate, Pipeline table + drawer. **D5 Counselor handoff** (family side and drawer).
8. Staff: Homes and Match with outreach drafting.
9. Staff: Insights chart + **D6 Program simulator**.
10. **D3 Talk instead of type.**
11. **D7 Monday check-in agent.**
12. **D8 Share card**, PDF download, README, final screenshots.
13. Full QA pass (§9.4 bug bash), fix everything found, tag `v0.1-hackathon`.

If time runs short, cut in this order: D8 → D7 → D3 → D5 → D4 → PDF → Match reasons → statement extraction → D6. Never cut the Road, the levers, D1, D2, or the Pipeline. Step 13 is never cut; shorten the feature list instead.

Use subagents where it saves wall-clock time: after step 4, one agent can build steps 7–9 (staff) while you build 5–6 (family), since they share only `engine.ts` and the Prisma schema. Merge through `main`, never through long-lived branches.

---

## 9. Quality gates: how you prove it works

### 9.1 `npm run check` (runs on every step, must be green before every push)
Wire these into one script in `package.json`:
1. `tsc --noEmit` (strict, zero errors)
2. `eslint .` (zero errors; warnings allowed)
3. `vitest run` (engine + API schema tests)
4. `prisma validate`
5. `next build` (catches server/client boundary mistakes and missing env usage)

### 9.2 Playwright e2e (`e2e/`, run with `npm run e2e` against `next dev` with seeded data)
Write these as real tests, not smoke checks, and mock Claude with a fixture layer (`lib/claude.ts` reads `MOCK_CLAUDE=1` and returns canned JSON from `fixtures/`) so e2e never depends on the network or spends credits.
- `family-flow.spec.ts`: completes all five intake screens by keyboard only, lands on the result, asserts the ready date is a real month, drags the "Extra toward debt" slider and asserts the ready date gets earlier, picks a home in D1 and asserts the sliders changed and the sentence names that home, saves the plan, opens `/plan/[code]`, ticks a checklist item, reloads, asserts it stays ticked.
- `spanish.spec.ts`: toggles to Spanish on the welcome screen, asserts every visible string on screens 1–6 is Spanish (no English leakage; check a list of 15 known strings), downloads the PDF, asserts the filename ends in `-es.pdf`.
- `staff.spec.ts`: wrong password rejected, right password accepted, pipeline shows 14 seeded families in the correct stage buckets (assert the counts), opening a drawer shows the same ready date the family page computed for that profile, Homes shows a non-zero ready count for at least one home, Match drafts an outreach that contains the family surname, Insights simulator toggle changes the "more families ready" number from 0 to > 0.
- `uploads.spec.ts`: uploads `fixtures/paystub.png` and asserts the income field is prefilled and shows the "From your pay stub" tag; uploads `fixtures/not-a-statement.txt` and asserts a friendly error, not a crash.
- `a11y.spec.ts`: runs `@axe-core/playwright` on every route; zero serious or critical violations.

Create the fixture images yourself (render a fake pay stub and a fake bank statement to PNG with a small script; plausible but obviously fictional employer and bank names).

### 9.3 Resilience rules (enforce in code, verify by test)
- Every Claude call has a 20-second timeout, one retry, and a rules-based fallback. Kill the network and the app must still produce a plan (a plainer one) and never show a spinner for more than 20 seconds.
- Every API route validates input with Zod and returns `{ error: { code, message } }` on failure. Never a 500 with a stack trace.
- Engine inputs are clamped: income 0–50,000/mo, household 1–8, rent 0–10,000, debts ≥ 0. A $0 income profile produces an "add income to see a path" state, not NaN anywhere. Add a test that renders the result screen with an all-zeros profile and asserts no "NaN", "Infinity", or "undefined" text appears.
- Slider dragging never calls the network. Verify with the Playwright network log: zero requests during a drag.
- Refreshing any screen mid-flow restores it from localStorage.
- `/plan/notarealcode` shows "We couldn't find that plan. Check the code or start a new one," with a button to start over.

### 9.4 Bug bash checklist (step 13; do every item, fix, re-run §9.1–9.2)
Work through this on a 390×844 window and a 1440×900 window, and record what you fixed in `docs/QA.md`:
1. Household of 1 and of 8; income exactly on each tier boundary; rent = 30.0% of income exactly.
2. All debts $0 and savings above the down-payment target: ready date should be near-term, and "Why this date" should say so without inventing blockers.
3. A profile that is not eligible (outside OC): the result still shows the road, with an honest banner, and staff see it under "Not eligible (why)".
4. Spanish toggle on every screen including PDFs, letters, share card, and outreach drafts.
5. Upload a 12 MB image, a PDF, a HEIC from an iPhone, and a text file. All handled or rejected kindly.
6. Keyboard-only run of the whole family flow. Visible focus ring on every control.
7. Slider at 0 and at max; rapid dragging; two fingers on mobile.
8. D1 with a home that is impossible: message is honest and offers the earliest reachable home.
9. Staff drawer open → browser back → no broken state.
10. Run the Monday check-in twice in a row: the second run reports no changes, not duplicates.
11. Two tabs editing the same plan: last write wins, no crash.
12. Lighthouse mobile on `/` and `/plan/[code]`: Performance ≥ 85, Accessibility ≥ 95.
13. Read every piece of copy once more against §4 voice rules; delete anything that sounds like marketing.
14. Fresh clone on a second machine: README setup commands work first try with no extra steps.

### 9.5 Pre-demo script (`npm run preflight`)
One command that: resets the DB, reseeds, runs §9.1, runs §9.2 with mocks, then makes one real Claude call to `/api/plan` and prints the tokens used, and finally prints "READY" with the local URL and the staff password. Run it 60 minutes before the submission deadline and again before the pitch.

---

## 8. Demo script (3 minutes, put in README)

1. Open `/` on a phone-sized window, toggle Spanish, tap the microphone and say "somos cuatro, vivimos en Santa Ana, gano como cinco mil doscientos al mes, pagamos dos mil trescientos cincuenta de renta." Watch the fields fill. Switch back to English for the audience.
2. Upload the sample pay stub in `/public/samples`; show the income field auto-fill. Add a $1,900 collection and $3,100 saved.
3. Land on the result. Let the road draw. Read the date aloud. Drag "Extra toward debt" to $150 and watch the date move from 19 months to 11. Say: "That's the conversation Habitat has never been able to have in a number."
4. Tap "Aim for a specific home", pick the Costa Mesa 3-bedroom. The sliders snap, the road redraws, the sentence says exactly what it takes. Then scroll to "Ten years from now" and read the equity number.
5. Open Underwriter's eye; show one flag; tap "Write my explanation letter"; show the letter.
6. Open `/staff`. Pipeline: "Ready in ≤ 6 months: 5 families." Homes: "Costa Mesa 3BR, March 2027: 4 families projected ready." Match → Draft outreach.
7. Insights: toggle "Matched savings $100/month" and read the headline: "12 more families ready by December 2027, for $48,000."
8. Click "Run Monday check-in"; let three families stream in. Close on: "Habitat finishes 100 homes; Homestretch makes sure 100 families are ready to buy them, and never loses one on the way."

Begin with step 1 of the build order and continue through step 13 without pausing.
