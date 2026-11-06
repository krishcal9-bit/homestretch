# QA pass (step 13)

Automated: `npm run check` (tsc, eslint, 26 Vitest tests, prisma validate, next build) and `npm run e2e` (family flow by keyboard, Spanish, staff, uploads, accessibility, bug bash). All green at tag `v0.1-hackathon`.

## Bug bash (§9.4)

| # | Check | Result / fix |
|---|---|---|
| 1 | Household of 1 and 8; income exactly on a tier boundary; rent exactly 30% | Renders, no NaN. Boundary incomes go to the higher tier (tested). Exactly 30% is not "need" (spec says > 30%); "Why this date" says so plainly. `e2e/bugbash.spec.ts` |
| 2 | No debt, savings above target | "You could start your application now." No invented blockers. **Fixed:** in mock mode the plan came from a static fixture that mentioned collections for every family; mock mode now uses the engine-based plan. |
| 3 | Not eligible (outside OC) | Road still shows with an amber banner; staff see the family under "Not eligible (why)". |
| 4 | Spanish everywhere | `e2e/spanish.spec.ts` checks screens 1–6 for 18 English strings and that the PDF is `-es.pdf`. Letters, share card, plan PDF and nudges follow the family's language. Staff UI is English by design (internal tool). |
| 5 | 15 MB photo, PDF, HEIC, text file | 15 MB JPEG downscaled with sharp and read in ~3 s; a PDF that isn't a pay stub gets "We couldn't read a pay stub…"; HEIC → "take a screenshot" message; text → "photos and PDFs only". Files over 20 MB are rejected kindly. All messages are localized. |
| 6 | Keyboard-only family flow | `family-flow.spec.ts` does the whole intake by keyboard. **Fixed:** focus jumped to the outgoing screen's title during transitions; Enter on a segmented control didn't submit (now it does, like a native radio). |
| 7 | Sliders at 0 and max, rapid drag | No NaN; values beyond the slider range from a D1 solve stretch the range. Drag makes zero network requests (asserted). |
| 8 | D1 impossible home | Honest message plus the earliest home that works (Santa Ana Jan 2027 for the demo family). |
| 9 | Drawer → browser back | Drawer closes, pipeline intact (drawer state lives in `?family=`). |
| 10 | Monday check-in twice | Second run: "No changes since the last check-in." (snapshots saved per family). |
| 11 | Two tabs editing one plan | **Fixed:** lost update when two tabs ticked different items at once. The PATCH is now a compare-and-swap on `updatedAt` with retries. |
| 12 | Lighthouse mobile | `/`: Performance 87, Accessibility 100, CLS 0. `/plan/NGU7P3`: Performance 87, Accessibility 100, CLS 0. |
| 13 | Copy voice | Sentence case, verbs on buttons; removed "Submit"-style wording; staff empty state tells staff what to do. |
| 14 | Fresh clone | `npm run setup` then `npm run dev` (README). Verified commands in this container. |

Other fixes found along the way: amber flag text failed contrast in the pipeline table (token darkened to `#8A5F0E`); upload inputs lacked labels; Road forced horizontal scroll on phones and hid the Keys marker (now fits, stacks labels); the letter text area clipped its last line; the plan JSON from Claude was truncated at 1,800 tokens in Spanish (limit raised, prompt tightened).

Known noise: the dev server occasionally logs `SyntaxError: Unexpected end of JSON input` when a test navigates away mid-request (aborted body). No route crashes; every route validates with Zod and returns `{ error }`.

## apple-design restraint check

Every screen is a utility surface. For each effect: "remove it — does the design lose meaning or just decoration?"

Removed or never added (decoration only):
- Card shadows everywhere (only the staff drawer has one), gradient fills, glass/translucency on panels.
- An icon beside every heading; sparkle/"AI" badges; emoji.
- A second accent: brass appears only on the ready date, the Keys marker and the current-position dot.
- Animation on page load other than the Road; looping or self-bouncing motion; hover lifts on buttons.
- The forced 600 px scrolling Road on phones (it hid Keys and added nothing).
- The duplicated "changes" line under each check-in digest when it repeated the digest.
- Static fixture plans in mock mode (they "explained" blockers a family didn't have).

Kept because they carry meaning: the Road draw-in (once per visit; shows the journey), rolling numbers and month crossfade (show what changed), slider thumb growth (confirms the grab), D1 slider glide (shows the plan being solved), drawer slide, chart growth/morph, check-in rows rising as they stream.

See also [UI_REVIEW.md](UI_REVIEW.md) for the pro-ui-craft Part 5 pass.
