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
