# AGENTS.md

This file defines project-specific engineering rules for automated agents and contributors.

## Stack and core constraints

- The app uses **SvelteKit + Svelte 5**.
- Package/runtime tooling is **Bun-first**. Use `bun`/`bun run` instead of `npm` for project workflows.
- Prefer **modern Svelte 5 patterns/features** where applicable instead of legacy Svelte 3/4 style.
- The codebase is **TypeScript-first** and should be treated as **strict**.
- Do not introduce `any` or loose typing unless there is a strong reason and it is clearly justified.
- The app should remain **free of TypeScript errors** (`bun run check` must pass).
- Styling uses **SCSS modules** conventions in the app. Keep styling changes consistent with existing SCSS/module usage patterns.
- Database schema and migrations are owned in this repo via **Drizzle** (`drizzle.config.ts`, `drizzle/`, `src/lib/server/infrastructure/db/schema.ts`).
- Do not reintroduce migration ownership in external projects (old `z-mg` flow is decommissioned for migrations).
- KOReader plugin distribution is startup-synced from local plugin files to R2 and exposed via API endpoints (`/api/plugin/koreader/latest`, `/api/plugin/koreader/download`).
- KOReader plugin release metadata source-of-truth is the DB table `PluginReleases` (not an R2 `latest.json` manifest).
- Book search is provider-agnostic via `POST /api/search` and `SearchProviderPort` implementations (e.g. Z-Library, OpenLibrary). New providers must return the normalized search response shape and explicit capability flags.
- Non-Z-Library search-result downloads are handled through `POST /api/search/download` with provider-specific safe handling.

## Architecture rules

### Layering

- `src/lib/server/domain`: pure business logic, value objects, entities, rules.
- `src/lib/server/application`: use-cases, ports, and dependency composition.
- `src/lib/server/infrastructure`: concrete adapters (DB, storage, external clients, queue).
- `src/routes/api`: thin controllers only.

### Dependency direction

- Routes depend on application use-cases.
- Use-cases depend on ports/interfaces, not concrete infrastructure classes.
- Infrastructure implements ports.
- Domain does not depend on infrastructure or HTTP concerns.

## API/controller conventions

Routes should do only:
1. Parse input
2. Validate required fields
3. Call one use-case (prefer via `src/lib/server/application/composition.ts`)
4. Map result to HTTP response

Error payload format must remain:

```json
{"error":"message"}
```

## Result pattern

- Use-case methods should return the project Result pattern (`ApiResult<T>`).
- Avoid throwing for expected business errors.
- Map result errors to HTTP status at the controller boundary.

## Feature workflow

When adding a feature:
1. Define request/response/error contract.
2. Add or update domain rules/entities if needed.
3. Implement a focused use-case in `application/use-cases`.
4. Wire dependencies in `application/composition.ts`.
5. Keep API route/controller thin.
6. Update client-facing DTOs under `src/lib/types` when frontend consumes the API.
7. Run `bun run check` and ensure zero type errors.

## Quality gates

Before finishing a change:
- `bun run check` passes with **0 TypeScript errors**.
- No architectural regression (business logic drifting into routes/infrastructure glue).
- Naming is consistent with current conventions (`*UseCase`, `*Client`, etc.).

## Drizzle migration safety rules

- Never leave a trailing `--> statement-breakpoint` as the last line of a migration file.
- Every `--> statement-breakpoint` must separate two real SQL statements, not create an empty SQL segment.
- For single-statement migrations, do not add a breakpoint at all.
- Before handing off migration changes, run a quick file sanity pass to ensure no empty segments exist.
- Migration file names must be explicit and descriptive (e.g. `0015_queue_jobs_cleanup.sql`), never random auto-generated slugs.
- If `drizzle-kit generate` creates a random slug name, rename the SQL file immediately and update the matching `tag` in `drizzle/meta/_journal.json` in the same change.

## Change memory and implementation plans

- If a major project reality changes (DB stack, migration workflow, deployment workflow, architecture policy, or core technology), update `AGENTS.md` in the same change so future agents do not lose that context.
- For any non-trivial implementation (new feature, refactor phase, workflow/infra change), create a temporary implementation plan in `docs/implementation-plans/` before implementation starts.
- Treat implementation-plan creation as mandatory, not optional, for this project.
- Keep implementation plan docs focused: scope, phases, risks, cutover/rollback, and done criteria.
- Once implementation is fully complete, delete the corresponding plan file from `docs/implementation-plans/` so this folder does not become permanent stale documentation.
- Keep Bruno requests in sync with API changes. When adding or changing endpoints, update the matching requests under `z-ui-bruno/Z-UI/`.
