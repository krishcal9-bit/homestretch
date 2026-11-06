# Decisions

Ambiguities resolved during the build, with the choice made.

- **Branch.** The spec (§0) asks for work on `main`; the session was set up on `claude/affectionate-tesla-sjf5ev`. Commits go to `main` as the spec asks, and the session branch is kept in sync with it.
- **Font loading.** `next/font/google` can't download font files in the build sandbox, so Public Sans is self-hosted via `@fontsource/public-sans`. Same typeface and weights, and it also works offline.
- **Prisma 6, not 7.** Prisma 7 needs driver adapters and a new config file. Prisma 6.19 keeps the classic SQLite setup and still supports `@prisma/adapter-libsql` for Turso.
- **apple-design references.** The skill's reference files (restraint checklist etc.) are not present in this environment; only its SKILL.md loaded. Its principles are applied from SKILL.md plus BUILD_SPEC §4.
- **One `Plan` table for families.** Seeded families and families who share their code are `sharedWithStaff = true`; a family's own saved plan stays private until shared (consent-first, §2.A.6).
- **Income tiers 5–8** are estimated at +7.5% per person compounded from the 4-person row, rounded to $50.
- **Tier boundaries** that appear in two tiers (e.g. $65,150) go to the higher tier.
