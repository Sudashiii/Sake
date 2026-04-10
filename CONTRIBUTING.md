# Contributing to Sake

Thanks for contributing to Sake.

This repository contains the Sake web app, backend, and KOReader plugin. The project is open source and licensed under `AGPL-3.0-only`, so contributions should stay compatible with open redistribution.

## Repository layout

This repo has a nested app structure:

- `sake/` - the actual SvelteKit application
- `koreaderPlugins/` - KOReader plugin source
- `docs/` - shared project documentation

If you are changing the app, run commands from `sake/`, not from the repository root.

## Before you start

Please:

- check whether there is already an issue or discussion for the change
- keep changes open-source friendly
- avoid breaking existing API behavior, storage contracts, or KOReader flows unless the change is explicitly intentional
- keep changes focused and additive when possible

For larger work, it helps to open an issue first so the approach can be aligned before implementation begins.

## Local setup

Sake is Bun-first and uses SvelteKit + Svelte 5 with strict TypeScript.

From `sake/`:

```bash
bun install
```

Create an env file from the example and configure your database and S3-compatible storage:

```bash
cp .env.example .env
```

Then run:

```bash
bun run db:migrate
bun run dev
```

Open `http://localhost:5173`.

If you prefer Docker, the main setup options are documented in [README.md](./README.md).

## Useful commands

Run these from `sake/`:

```bash
bun run dev
bun run check
bun test
bun run db:generate
bun run db:migrate
```

Before opening a pull request, `bun run check` should pass with zero TypeScript errors.

## Architecture expectations

Please preserve the existing layering:

- `src/lib/server/domain` - interfaces for the domain
- `src/lib/server/application` - use-cases, ports, composition
- `src/lib/server/infrastructure` - concrete adapters
- `src/routes/api` - thin controllers only

Routes should:

1. Parse input
2. Validate required fields
3. Call one use-case
4. Map the result to an HTTP response

Expected business errors should use the project `ApiResult<T>` pattern instead of throwing.

## KOReader plugin changes

If you touch `koreaderPlugins/`, please preserve these boundaries:

- controllers are KOReader-facing orchestration
- engines are pure workflow logic
- adapters handle KOReader/runtime access
- UI code should stay out of engines

The plugin release source of truth is the database metadata managed by the app, not a storage manifest. You need to manually update the version number in _meta.lua so it will get recongniced as a new version.

## Database and migration notes

Schema and migrations live in `sake/`.

- schema: `src/lib/server/infrastructure/db/schema.ts`
- migrations: `drizzle/`

When generating migrations:

- use `bun run db:generate`
- keep migration filenames explicit and descriptive
- do not leave a trailing `--> statement-breakpoint`
- make sure breakpoints only separate real SQL statements

If a generated migration includes unrelated full-schema SQL, trim it back to the minimal intended change while keeping Drizzle metadata in sync.

## Code style

Please follow the existing project conventions:

- use TypeScript-first, strict typing
- avoid `any` unless there is a strong and clearly justified reason
- prefer modern Svelte 5 patterns over legacy Svelte style
- keep styling consistent with the existing SCSS module approach
- preserve license headers and avoid adding incompatible assets or code

## Documentation and API changes

If your change affects contributor or user workflows, update the relevant docs.

If you add or change API endpoints, also update the Bruno requests under `sake-bruno/` in the workspace that accompanies this repository.

## Pull requests

A good pull request usually includes:

- a clear summary of what changed
- any relevant screenshots for UI work
- notes about schema, env, or migration changes
- confirmation that `bun run check` passes
- tests where they add confidence

Small, focused PRs are much easier to review than broad mixed changes.

Please keep PRs as small as reasonably possible. If a change can be split into a few independent, reviewable steps, prefer opening several smaller PRs instead of one large one.

## AI usage

AI tools are allowed, but please use them responsibly.

- do not make changes you do not understand
- verify generated code before submitting it
- test the behavior you changed instead of assuming the output is correct
- avoid changing many unrelated things at once just because a tool suggested them
- keep AI-assisted PRs especially small and reviewable
- when in doubt, slow down and narrow the change before opening the PR
- avoid AI Co-Authors since this repo is not a free ad-space
- avoid unnecessary AI comments like 

<code>
// gets the books <br />
repository.getBooks();
<br />
</code>
<br />


AI can help with drafting, refactoring, and boilerplate, but contributors are still responsible for the final code, architecture fit, and correctness of the change.

## Need help?

If you are unsure where a change belongs, open a discussion or draft PR and describe the goal before going too far down the implementation path. That is especially helpful for architecture, migration, or KOReader sync changes.
