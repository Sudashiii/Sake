# sake

Small fullstack SvelteKit app for searching Z-Library, downloading books, and syncing a personal library/progress data.

It runs as a single SvelteKit service (Svelte 5 + adapter-node), with API routes and server-side logic in the same repo.

## Quick start

```bash
bun install
bun run dev
```

Open `http://localhost:5173`.

## Environment

Copy `.env.example` to `.env` and fill in required values.

Main groups:
- Generic libSQL database config (`LIBSQL_*`)
- Generic S3-compatible storage config (`S3_*`)
- Local account credentials for the web app plus optional OPDS/WebDAV Basic auth
- Optional Vite dev host overrides (`VITE_ALLOWED_HOSTS`, comma-separated)
- Optional search-provider activation (`ACTIVATED_PROVIDERS`, comma-separated; providers are opt-in, so leave unset/empty to disable search entirely)

`LIBSQL_AUTH_TOKEN` is optional. For local self-hosting, `LIBSQL_URL=file:/data/sake.db` is supported.
For Cloudflare R2, use `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, and `S3_FORCE_PATH_STYLE=false`.

## Self-host reference stack

The repository root includes both source-build and prebuilt-image compose files:

- [`docker-compose.selfhost.yaml`](../docker-compose.selfhost.yaml) for a self-hosted source build
- [`docker-examples/docker-compose.prebuilt.selfhost.yaml`](../docker-examples/docker-compose.prebuilt.selfhost.yaml) for the published image
- [`docker-compose.yaml`](../docker-compose.yaml) for a managed source build
- [`docker-examples/docker-compose.prebuilt.yaml`](../docker-examples/docker-compose.prebuilt.yaml) for a managed prebuilt image

It uses:
- a file-backed libSQL target by default (`LIBSQL_URL=file:/data/sake.db`)
- SeaweedFS as the primary self-hosted S3-compatible object store example

Start the published image from the repository root with:

```bash
docker compose -f docker-examples/docker-compose.prebuilt.selfhost.yaml up
```

Or build it locally from source with:

```bash
docker compose -f docker-compose.selfhost.yaml up --build
```

You can switch to another libSQL-compatible target or S3-compatible backend by overriding the `LIBSQL_*` and `S3_*` environment variables.
By default, the self-host stack persists data under `../.data/selfhost/`:

- `../.data/selfhost/libsql`
- `../.data/selfhost/seaweedfs`

If the database is empty on first run, Sake exposes the normal bootstrap flow so you can create the first account in the UI. No env-defined user is required for the self-host stack.

## Useful scripts

```bash
bun run dev
bun run build
bun run preview
bun run check
bun run db:generate
bun run db:migrate
```

One-time repair for databases that already match the latest schema but have missing Drizzle migration metadata:

```bash
bun run db:state:mark
```

## Project layout

- `src/routes`: Svelte pages + API endpoints (`+server.ts`)
- `src/lib/client`: browser-facing API client wrappers
- `src/lib/server/domain`: domain entities + pure business rules
- `src/lib/server/application`: use-cases + ports + composition wiring
- `src/lib/server/infrastructure`: DB/repository/storage/external clients

## License

This repository is licensed under the GNU Affero General Public License v3.0 (`AGPL-3.0-only`).
See `../LICENSE` at the repository root for the full license text.
