# Homestretch: rules for every session (full spec: BUILD_SPEC.md)

## Engine (lib/engine.ts): deterministic, pure TS, no LLM
- Claude only explains and plans around engine numbers; it never produces them.
- Tier: (gross + other + coApplicant) * 12 against lib/incomeTiers.ts (sizes 5–8 estimated).
- Need: costBurden > 0.30 || overcrowded (> 2 per bedroom) || unsafeConditions.
- Debt sim month by month: collections first, then highest-APR card. Budget = sum of minPayments + extraDebt.
  Default APR: card 24%, car 8%, student 6%, collection 0%. Done when collections = 0 and card util < 30% (limit = balance/0.9).
- Credit: good → 0; building → max(debt, 6); needs_work → max(debt + 6, 12); unknown → building + blocker.
- Savings: savings + monthlySavings*m (+ freed minPayments after payoff) ≥ downPaymentTarget (3% + 2% of financeableHome, round $100).
- Orientation = max(credit, savings) - 2 (≥0); application = orientation + 1; keys = max(app, credit, savings) + 9.
- maxPayment = 0.30 * gross; financeableHome = maxPayment * 360 (0% Habitat note).
- Score = 100 - 4*months (floor 5), -25 if any eligibility false, +5 statement with 0 overdrafts; clamp 0–100. Staff only.
- Must run < 2 ms. Inputs clamped. Zero income → "add income" state, never NaN.
- Also: solveForDate, tenYearComparison, simulateProgram. Vitest tests in tests/.

## Design tokens (app/globals.css). Never deviate
- paper #F6F7F5, surface #FFF, ink #182420, ink-2 #4A5753, line #DDE3DF, pine #1E5C47, pine-soft #E4EFEA.
- brass #B8862B ONLY for ready date, Keys marker, current road position. signal-red/amber as text + 2px left rule.
- Public Sans 400/500/600 (self-hosted via @fontsource). Tabular nums for money/dates. Scale 13/16/20/28/56.
- Radius 8 controls, 14 panels. No shadows (except staff drawer). No dark mode, glass, gradients, emoji, caps eyebrows, "→" in buttons.
- Motion: only `motion/react` with tokens from lib/motion.ts; MotionConfig reducedMotion="user". Only the Road animates on load.
- Copy: sentence case, verbs that say what happens. All UI strings in messages/{en,es}.json.
- Load the apple-design skill before UI work (steps 1, 4, 7, 13).

## Build order (commit + push to main after each, `npm run check` green first)
1 scaffold/tokens/i18n/seed · 2 engine+tests · 3 intake 1–5 · 4 result+Road+levers+D1+D2
5 /api/plan, checklist, save, /plan/[code], first e2e · 6 uploads + D4 letters
7 staff gate, pipeline, drawer, D5 · 8 Homes + Match + outreach · 9 Insights + D6
10 D3 voice · 11 D7 check-in · 12 D8 share card, PDF, README · 13 QA, tag v0.1-hackathon
Cut order: D8 → D7 → D3 → D5 → D4 → D6. Never cut Road, levers, D1, D2, Pipeline.

## Conventions
- Claude client only in lib/claude.ts (APP_ANTHROPIC_API_KEY, MOCK_CLAUDE=1 → fixtures/). Model claude-sonnet-5-5.
- Every API route: Zod-validated input, `{ error: { code, message } }` on failure, 20s timeout, 1 retry, rules fallback.
- Commits: `feat(step-N): ...`. Screenshots in docs/screenshots/. Decisions in docs/DECISIONS.md.
