# Sake Project Analysis and Function Catalog

Last reviewed: 2026-03-13

## 1) Project overview

This repository currently has three main active areas:

- `sake`: the main SvelteKit fullstack app (UI, API, application layer, domain layer, infrastructure)
- `koreaderPlugins`: KOReader plugins (`sake.koplugin` and `sakeUpdater.koplugin`)

Core product behavior today:

1. Users authenticate locally in the Sake web app.
2. Devices authenticate with device API keys.
3. Books can be searched through normalized search providers (`zlibrary`, `openlibrary`, `gutenberg`).
4. Search results can either be downloaded directly or imported/queued into the personal library.
5. The library stores metadata, ratings, progress, shelves, read/archive/trash state, and device download acknowledgements.
6. KOReader syncs books, progress, plugin version, and plugin updates through `sake` APIs.
7. KOReader plugin release artifacts are built from local plugin sources, uploaded to S3-compatible object storage, and versioned in the database.

## 2) Architecture summary

`sake` follows the current layered architecture used throughout the codebase:

- `src/routes/api`: thin HTTP controllers only
- `src/lib/server/application/use-cases`: workflow orchestration via `execute()` entrypoints
- `src/lib/server/application/services`: higher-level services used by use-cases
- `src/lib/server/application/ports`: interfaces for infrastructure dependencies
- `src/lib/server/domain`: entities, value objects, pure rules
- `src/lib/server/infrastructure`: DB, repositories, queue, storage, external clients, provider implementations
- `src/lib/client`: typed browser-side client facade and route wrappers

The frontend is now also split more deliberately than before:

- `src/routes`: route shells and page orchestration
- `src/lib/features/*`: feature-specific helpers and decomposed components
- `src/lib/components/*`: shared UI primitives and cross-feature components
- `src/lib/assets/icons` and `src/lib/assets/svg`: reusable SVG/icon components

## 3) Global server behavior (`src/hooks.server.ts`)

Global hooks currently add:

- structured request logging and `x-request-id`
- session-cookie and device API-key auth resolution
- public/protected/API-key-allowed route gating
- cookie-based Z-Library credential hydration (`locals.zuser`)
- periodic trash purge trigger (6-hour cadence, single-flight)
- startup KOReader plugin artifact sync
- device version sync from the `Sake-Version` header on authenticated device API requests

## 4) Data model (Drizzle)

Main tables in `src/lib/server/infrastructure/db/schema.ts`:

- `Books`: canonical library entries and book-level metadata/state
- `PluginReleases`: KOReader plugin artifact metadata and latest marker
- `Users`: local Sake accounts
- `UserSessions`: browser session records
- `UserApiKeys`: device/API key records
- `Devices`: registered devices with plugin version and last-seen timestamps
- `DeviceDownloads`: per-device book download acknowledgements
- `DeviceProgressDownloads`: per-device progress sync watermark acknowledgements
- `BookProgressHistory`: immutable progress history snapshots
- `QueueJobs`: persisted queue job history/state
- `Shelves`: user-defined shelves and rule groups
- `BookShelves`: manual book-to-shelf assignments

Notable book-state fields in `Books` now include:

- metadata fields such as `author`, `publisher`, `series`, `edition`, `pages`, `language`, `year`
- external metadata references such as `googleBooksId`, `openLibraryKey`, `amazonAsin`
- external rating fields such as `externalRating` and `externalRatingCount`
- reading/progress fields such as `progressStorageKey`, `progressUpdatedAt`, `progressPercent`, `progressBeforeRead`, `readAt`
- lifecycle fields such as `archivedAt`, `deletedAt`, `trashExpiresAt`, `excludeFromNewBooks`

Storage split remains:

- files and binary artifacts live in S3-compatible object storage via `S3Storage`
- app/library/plugin state lives in the database

## 5) API surface and route mapping

All server endpoints are under `/api/*`.

### Core/system

- `GET /api/_routes` -> route catalog JSON
- `GET /api/app/version` -> build/deploy version metadata from `PUBLIC_WEBAPP_*`
- `GET /api/docs` -> HTML API docs page
- `PROPFIND /api/dav/*` -> WebDAV-style directory listing via `ListDavDirectoryUseCase.execute()`

### Local auth and account/session management

- `GET /api/auth/status` -> `GetAuthStatusUseCase.execute()`
- `POST /api/auth/bootstrap` -> `BootstrapLocalAccountUseCase.execute()`
- `POST /api/auth/login` -> `LoginLocalAccountUseCase.execute()`
- `POST /api/auth/logout` -> `LogoutLocalAccountUseCase.execute()`
- `POST /api/auth/logout-all` -> `LogoutAllLocalSessionsUseCase.execute()`
- `GET /api/auth/me` -> `GetCurrentUserUseCase.execute()`
- `POST /api/auth/device-key` -> `CreateDeviceApiKeyUseCase.execute()`
- `GET /api/auth/api-keys` -> `ListActiveApiKeysUseCase.execute()`
- `DELETE /api/auth/api-keys/[id]` -> `RevokeApiKeyUseCase.execute()`

### Device registry and device version reporting

- `GET /api/devices` -> `ListDevicesUseCase.execute()`
- `DELETE /api/devices/[deviceId]` -> `DeleteDeviceUseCase.execute()`
- `POST /api/devices/version` -> `ReportDeviceVersionUseCase.execute()`

### Provider-based book search

- `POST /api/search` -> `SearchBooksUseCase.execute()`
- `POST /api/search/download` -> `DownloadSearchBookUseCase.execute()`

Current provider ids:

- `zlibrary`
- `openlibrary`
- `gutenberg`

Search is now provider-agnostic, with each provider returning a normalized result shape and capability metadata.

### Z-Library-specific routes

These still exist because Z-Library login/session management and queue/import are Z-Library-specific concerns.

- `POST /api/zlibrary/login` -> `ZLibraryTokenLoginUseCase.execute()`
- `POST /api/zlibrary/passwordLogin` -> `ZLibraryPasswordLoginUseCase.execute()`
- `GET /api/zlibrary/logout` -> `ZLibraryLogoutUseCase.execute()`
- `POST /api/zlibrary/search` -> `ZLibrarySearchUseCase.execute()`
- `POST /api/zlibrary/download` -> `DownloadBookUseCase.execute()`
- `POST /api/zlibrary/queue` -> `QueueDownloadUseCase.execute()`
- `GET /api/zlibrary/queue` -> `GetQueueStatusUseCase.execute()`
- `POST /api/zlibrary/search/metadata` -> `LookupSearchBookMetadataUseCase.execute()`

### Library file transport and listing

- `GET /api/library/list` -> `ListLibraryUseCase.execute()`
- `GET /api/library/new?deviceId=...` -> `GetNewBooksForDeviceUseCase.execute()`
- `GET /api/library/[title]` -> `GetLibraryFileUseCase.execute()`
- `PUT /api/library/[title]` -> `PutLibraryFileUseCase.execute()`
- `DELETE /api/library/[title]` -> `DeleteLibraryFileUseCase.execute()`

Note: `/api/library/new` is still the current route name, but behaviorally it returns books pending download acknowledgement for that device.

### Library detail, state, metadata, and ratings

- `GET /api/library/[id]/detail` -> `GetLibraryBookDetailUseCase.execute()`
- `PUT /api/library/[id]/state` -> `UpdateLibraryBookStateUseCase.execute()`
- `PUT /api/library/[id]/metadata` -> `UpdateLibraryBookMetadataUseCase.execute()`
- `POST /api/library/[id]/refetch-metadata` -> `RefetchLibraryBookMetadataUseCase.execute()`
- `PUT /api/library/[id]/rating` -> `UpdateBookRatingUseCase.execute()`
- `GET /api/library/ratings` -> `ListLibraryRatingsUseCase.execute()`

### Download acknowledgement state

- `POST /api/library/confirmDownload` -> `ConfirmDownloadUseCase.execute()`
- `DELETE /api/library/[id]/downloads` -> `ResetDownloadStatusUseCase.execute()`
- `DELETE /api/library/[id]/downloads/[deviceId]` -> `RemoveDeviceDownloadUseCase.execute()`

### Shelves and shelf rules

- `GET /api/library/shelves` -> `ListShelvesUseCase.execute()`
- `POST /api/library/shelves` -> `CreateShelfUseCase.execute()`
- `PUT /api/library/shelves/[id]` -> `UpdateShelfUseCase.execute()`
- `DELETE /api/library/shelves/[id]` -> `DeleteShelfUseCase.execute()`
- `PATCH /api/library/shelves/reorder` -> `ReorderShelvesUseCase.execute()`
- `PUT /api/library/shelves/[id]/rules` -> `UpdateShelfRulesUseCase.execute()`
- `PUT /api/library/[id]/shelves` -> `SetBookShelvesUseCase.execute()`

### Trash lifecycle

- `GET /api/library/trash` -> `ListLibraryTrashUseCase.execute()`
- `POST /api/library/[id]/trash` -> `MoveLibraryBookToTrashUseCase.execute()`
- `POST /api/library/[id]/restore` -> `RestoreLibraryBookUseCase.execute()`
- `DELETE /api/library/[id]/trash` -> `DeleteTrashedLibraryBookUseCase.execute()`

### Progress sync

- `GET /api/library/progress?fileName=...` -> `GetProgressUseCase.execute()`
- `PUT /api/library/progress` -> `PutProgressUseCase.execute()`
- `GET /api/library/progress/new?deviceId=...` -> `GetNewProgressForDeviceUseCase.execute()`
- `POST /api/library/progress/confirm` -> `ConfirmProgressDownloadUseCase.execute()`
- `GET /api/library/[id]/progress-history` -> `GetBookProgressHistoryUseCase.execute()`

### Stats

- `GET /api/stats/reading-activity?days=...` -> `GetReadingActivityStatsUseCase.execute()`

### KOReader plugin distribution

- `GET /api/plugin/koreader/latest` -> `GetLatestKoreaderPluginUseCase.execute()`
- `GET /api/plugin/koreader/download` -> `GetKoreaderPluginDownloadUseCase.execute()`

These plugin update routes are currently public.

## 6) Application service and use-case inventory

### Current application services

- `EpubMetadataService`: EPUB metadata rewriting, especially title normalization in OPF/NCX
- `ExternalBookMetadataService`: external metadata lookup and source scoring
- `KoreaderPluginArtifactService`: plugin source discovery, zip build, hash generation
- `deviceVersion.ts`: normalization and validation of reported plugin/device version strings

### Current use-case groups

#### Auth/account/device use-cases

- `BootstrapLocalAccountUseCase`
- `LoginLocalAccountUseCase`
- `LogoutLocalAccountUseCase`
- `LogoutAllLocalSessionsUseCase`
- `GetCurrentUserUseCase`
- `GetAuthStatusUseCase`
- `ResolveRequestAuthUseCase`
- `CreateDeviceApiKeyUseCase`
- `ListActiveApiKeysUseCase`
- `RevokeApiKeyUseCase`
- `ListDevicesUseCase`
- `DeleteDeviceUseCase`
- `ReportDeviceVersionUseCase`

#### Search/download/provider use-cases

- `SearchBooksUseCase`
- `DownloadSearchBookUseCase`
- `LookupSearchBookMetadataUseCase`
- `ZLibrarySearchUseCase`
- `ZLibraryTokenLoginUseCase`
- `ZLibraryPasswordLoginUseCase`
- `ZLibraryLogoutUseCase`
- `DownloadBookUseCase`
- `QueueDownloadUseCase`
- `GetQueueStatusUseCase`

#### Library and metadata use-cases

- `ListLibraryUseCase`
- `GetLibraryBookDetailUseCase`
- `GetLibraryFileUseCase`
- `PutLibraryFileUseCase`
- `DeleteLibraryFileUseCase`
- `UpdateLibraryBookMetadataUseCase`
- `RefetchLibraryBookMetadataUseCase`
- `UpdateBookRatingUseCase`
- `ListLibraryRatingsUseCase`
- `UpdateLibraryBookStateUseCase`

#### Shelf use-cases

- `ListShelvesUseCase`
- `CreateShelfUseCase`
- `UpdateShelfUseCase`
- `DeleteShelfUseCase`
- `ReorderShelvesUseCase`
- `UpdateShelfRulesUseCase`
- `SetBookShelvesUseCase`

#### Trash/progress/plugin/stats use-cases

- `MoveLibraryBookToTrashUseCase`
- `RestoreLibraryBookUseCase`
- `DeleteTrashedLibraryBookUseCase`
- `PurgeExpiredTrashUseCase`
- `GetProgressUseCase`
- `PutProgressUseCase`
- `ConfirmProgressDownloadUseCase`
- `GetNewProgressForDeviceUseCase`
- `GetBookProgressHistoryUseCase`
- `ConfirmDownloadUseCase`
- `RemoveDeviceDownloadUseCase`
- `ResetDownloadStatusUseCase`
- `GetNewBooksForDeviceUseCase`
- `SyncKoreaderPluginReleaseUseCase`
- `GetLatestKoreaderPluginUseCase`
- `GetKoreaderPluginDownloadUseCase`
- `GetReadingActivityStatsUseCase`
- `ListDavDirectoryUseCase`

## 7) Domain and infrastructure notes

### Domain/value-object rules worth knowing

- `ProgressConflictPolicy.ts` prevents stale progress overwrites.
- `ProgressFile.ts` still contains progress-file descriptor and tolerant lookup helpers.
- `StorageKeySanitizer.ts` is responsible for normalized/path-safe storage keys.
- Shelf rules are represented as structured rule groups, parsed/validated through `src/lib/types/Library/ShelfRule`.

### Infrastructure adapters

- `BookRepository`: largest repository; handles library CRUD, progress, state changes, trash flows, and device-oriented queries
- `DeviceRepository`: user-scoped device registry plus global device-id ownership enforcement
- `DeviceDownloadRepository`: per-device download acknowledgement records
- `DeviceProgressDownloadRepository`: per-device progress acknowledgement watermarks
- `BookProgressHistoryRepository`: immutable progress snapshots
- `PluginReleaseRepository`: plugin release metadata
- `QueueJobRepository`: persisted queue job state/history in `QueueJobs`
- `S3Storage`: S3-compatible object adapter
- `ZLibraryClient`: Z-Library HTTP adapter
- search provider adapters under `src/lib/server/infrastructure/search-providers`:
  - `ZLibrarySearchProvider`
  - `OpenLibrarySearchProvider`
  - `GutenbergSearchProvider`

## 8) Queue behavior

The queue is no longer purely in-memory.

Current behavior:

- the worker loop is still process-local and single-worker
- queue job state/history is persisted in `QueueJobs`
- `QueueJobRepository` recovers state and keeps a historical record of queued/completed/failed jobs
- queue credentials are intentionally sanitized on persistence, so restart recovery marks active jobs failed when credentials cannot safely be restored

Tradeoff:

- the queue now survives as job history/state, but actual processing is still tied to a single running app instance

## 9) Frontend structure inventory

### Top-level routes

Current pages under `src/routes`:

- `/` -> login/bootstrap screen
- `/search` -> provider-based search UI
- `/library` -> main library UI
- `/archived` -> archived books view
- `/trash` -> trash view
- `/queue` -> queue status/history UI
- `/stats` -> reading activity stats UI

### Frontend feature folders

Current decomposed feature areas:

- `src/lib/features/search`
- `src/lib/features/library`
- `src/lib/features/archived`
- `src/lib/features/trash`
- `src/lib/features/queue`
- `src/lib/features/stats`

### Shared component areas

Current shared component areas include:

- `src/lib/components/layout/*`
- `src/lib/components/sidebar/*`
- `src/lib/components/shelfRules/*`
- shared primitives such as `BookCard`, `BookDetailModalShell`, `ConfirmModal`, `DropDown`, `MultiSelectDropdown`, `Toast`, `ToastContainer`, `Loading`

The frontend is no longer organized around a few monolithic Svelte files; route shells now delegate significant UI to feature/component folders.

## 10) Client-side API facade (`src/lib/client`)

The main browser-side facade is `ZUI` in `src/lib/client/zui.ts`.

Major current client groups include:

- auth/account methods
- device management methods (`getDevices`, `deleteDevice`)
- provider-based search methods (`searchBooks`, `downloadSearchBook`, `lookupSearchBookMetadata`, `queueSearchBookToLibrary`)
- queue status methods
- library detail/state/metadata/rating methods
- shelf management methods
- stats methods

The client returns typed `Result` values and mirrors the server-side error contract.

## 11) KOReader plugin inventory

### `koreaderPlugins/sake.koplugin`

Main responsibilities:

- persistent device identity handling
- settings lifecycle and validation
- menu wiring
- book sync
- progress sync
- plugin update check/trigger
- startup and reader lifecycle integration
- device API requests using the shared session/request stack
- sending `Sake-Version` headers on requests

Key modules:

- device and settings helpers
- `api/*` request wrappers
- `services/book_sync.lua`
- `services/progress_sync.lua`
- `main.lua`

All plugin logger output is expected to carry the `[Sake]` prefix.

### `koreaderPlugins/sakeUpdater.koplugin`

Main responsibilities:

- check latest plugin release metadata
- compare installed vs latest version
- download the latest plugin archive
- replace plugin files during update

## 12) Non-functional analysis

Current strengths:

- architecture is still cleanly layered overall
- routes remain thin and mostly controller-only
- API error shape is consistent (`{"error":"message"}`)
- the Result pattern is used across server and client boundaries
- provider-based search abstraction is now in place
- queue history/state persistence is better than the earlier in-memory-only design
- frontend structure is much clearer after the decomposition pass

Current tradeoffs and risks:

- queue processing is still single-instance/process-local even though state is persisted
- `/api/library/new` is still legacy naming for per-device pending downloads
- external metadata quality depends on third-party source quality and heuristic matching
- some large orchestration files still exist, especially around library and sidebar state
- legal/operational risk is more about provider integrations than about the core app structure itself

## 13) Quick inventory by folder

- `sake/src/routes`: page shells and API controllers
- `sake/src/lib/server/application`: use-cases, services, ports, composition
- `sake/src/lib/server/domain`: entities, value objects, pure rules
- `sake/src/lib/server/infrastructure`: DB, repositories, storage, queue, provider adapters, external clients
- `sake/src/lib/client`: typed client facade and route wrappers
- `sake/src/lib/features`: decomposed frontend feature UIs and helpers
- `koreaderPlugins/sake.koplugin`: main KOReader sync plugin
- `koreaderPlugins/sakeUpdater.koplugin`: updater plugin
