# Dev Guide

This is the short version of how this app is structured and how to add a feature without turning routes into mini-services again.

## Architecture (what goes where)

### `src/lib/server/domain`
Pure business logic and core models.

Examples:
- entities (`Book`, `DeviceDownload`)
- rules (`ProgressConflictPolicy`)
- value objects (`ProgressFile`)

No HTTP, no DB client calls, no S3 calls in this layer.

### `src/lib/server/application`
Use-cases, ports, and dependency wiring.

- `ports/`: interfaces for external dependencies (repositories, storage, external clients)
- `use-cases/`: orchestration logic
- `composition.ts`: app wiring (`new ...`) in one place

Use-cases return the Result pattern (`ApiResult<T>`), not thrown HTTP responses.

### `src/lib/server/infrastructure`
Implementations of ports.

Examples:
- repositories (DB access)
- external clients (`ZLibraryClient`)
- storage (`S3Storage`)
- queue worker

### `src/routes/api`
Controllers only.

Each route should:
1. Parse input
2. Validate required fields
3. Call one use-case (from `composition.ts`)
4. Map result to HTTP response

Error format should always be:
```json
{"error":"message"}
```

## Feature workflow (recommended)

Use this checklist for any new backend feature.

1. Define the API contract first
- Request fields
- Response shape
- Failure cases and status codes

2. Add/extend domain logic
- Add a domain rule/value object if needed
- Keep it free of infrastructure concerns

3. Add a use-case
- Put orchestration in `application/use-cases`
- Depend on ports, not concrete adapters
- Return `ApiResult<T>`

4. Wire dependencies once
- Update `application/composition.ts`
- Export a ready-to-use instance

5. Keep route handler thin
- Validate input
- Call composed use-case
- Return JSON / binary response
- Map errors with `errorResponse(...)`

6. Update client DTOs if endpoint is consumed by frontend
- Prefer `src/lib/types/...` for client-facing types
- Avoid importing server-domain types directly into client code

7. Run checks
```bash
bun run check
```

## Practical conventions

- Keep use-case names explicit: `VerbNounUseCase` (`PutProgressUseCase`, `DownloadBookUseCase`)
- Prefer one use-case per endpoint action
- Avoid static repository calls in new code paths (use composed instances)
- If you must add temporary debug/test endpoints, put a TODO with owner and remove date

## DB and migration workflow

- `sake` is the source of truth for DB schema and migrations.
- Schema lives in `src/lib/server/infrastructure/db/schema.ts`.
- Migration files live in `drizzle/`.
- Generate migration after schema changes:
```bash
bun run db:generate
```
- Apply migrations:
```bash
bun run db:migrate
```
- Existing environments that predate Drizzle needed a one-time baseline mark:
```bash
node --env-file=.env ./scripts/db/mark-drizzle-baseline.mjs
```
- In Docker Compose, run migrations explicitly with the migrator service via `docker compose run --rm sake-migrator`.

## Common pitfall to avoid

If route files start growing with:
- multiple storage calls
- multiple repository calls
- business comparisons/merging logic

that logic probably belongs in a use-case or domain service.
