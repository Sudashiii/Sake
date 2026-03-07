# AGENTS.md

Workspace root: repository root of this project.

Project-specific agent instructions live in:
- `./z-ui/AGENTS.md`

When working in the `z-ui` project, follow that file as the authoritative guide.
Major workflow/technology changes should be captured there immediately so future turns keep the right context.
Current important note: DB migrations are handled in `z-ui` (Drizzle), not `z-mg`.
API route lookup is available at `GET /api/_routes` (JSON) and `GET /api/docs` (HTML) in `z-ui`.
KOReader plugin download is exposed in `z-ui` via `GET /api/plugin/koreader/latest` and `GET /api/plugin/koreader/download`.
KOReader plugin release metadata is stored in `z-ui` DB (`PluginReleases`) while plugin artifacts stay in R2.
Drizzle migration names in `z-ui` must be explicit/descriptive (no random auto-generated slugs), and corresponding `drizzle/meta/_journal.json` tags must be updated when renamed.
Implementation plans for non-trivial `z-ui` work are mandatory in `./z-ui/docs/implementation-plans/`.

## Git workflow

- Before pushing, always check the current branch explicitly.
- Never push directly on `master`.
- You may create branches when needed.
- Branch names must use either `feature/<feature_desc>` or `fix/<fix_desc>`.
- If the correct branch name is unclear, do not commit yet. Leave the change uncommitted until it can be included in the next appropriate feature or fix branch.

## KOReader plugin logging

- For `koreaderPlugins/sake.koplugin`, all logger output must use the prefix `[Sake]`.
- This applies to `logger.info`, `logger.warn`, `logger.error`, and any other logger levels.
- Do not add unprefixed plugin log messages.
