# Z-DL Project Analysis and Function Catalog

Last reviewed: 2026-02-28

## 1) Project overview

This repository is a monorepo with three active areas:

- `z-ui`: Main SvelteKit fullstack app (UI + API + domain/use-cases + infrastructure).
- `koreaderPlugins`: KOReader plugins (`sake.koplugin` and `sakeUpdater.koplugin`) that sync books/progress and self-update via `z-ui` APIs.
- `z-ui-bruno`: Bruno API collection for manual API testing.

Core product behavior:

1. User authenticates to Sake with a local account (session cookie in the browser, device API keys for KOReader).
2. Search books via Z-Library.
3. Download immediately to device, or queue for background import into personal library.
4. Library tracks metadata, ratings, read/archive state, trash lifecycle, device download confirmations, and progress history.
5. KOReader plugin syncs new books and reading progress bidirectionally.
6. KOReader plugin release artifact is zipped from local plugin sources, uploaded to R2, and versioned in DB.

## 2) Architecture summary

`z-ui` follows a layered architecture:

- `src/routes/api`: thin HTTP controllers.
- `src/lib/server/application/use-cases`: orchestration/business workflows (`execute()` entrypoints).
- `src/lib/server/domain`: pure interfaces/value rules.
- `src/lib/server/infrastructure`: DB, storage, queue, external clients.
- `src/lib/client`: typed browser-side API client wrappers and stores.

Global server hooks (`src/hooks.server.ts`) add:

- structured request logging + `x-request-id`,
- local-account session / device API-key enforcement for protected routes,
- periodic trash purge trigger,
- startup KOReader plugin sync trigger,
- cookie-based Z-Library credential hydration (`locals.zuser`).

## 3) Data model (Drizzle)

Main tables in `src/lib/server/infrastructure/db/schema.ts`:

- `Books`: canonical library record (storage key, metadata, progress pointers, read/archive flags, trash timestamps, ratings).
- `DeviceDownloads`: device-to-book download confirmation state.
- `DeviceProgressDownloads`: per-device acknowledgment watermark for progress sync.
- `BookProgressHistory`: immutable progress snapshots per timestamp.
- `PluginReleases`: KOReader plugin release metadata (`version`, `storageKey`, `sha256`, `isLatest`).

Storage split:

- binary artifacts/files in R2 (`S3Storage`),
- release metadata/state in DB (`PluginReleases`).

## 4) API surface and route-function mapping

All API routes are under `/api/*`.

### Core/system

- `GET /api/_routes` -> `getApiRouteCatalog()` JSON route catalog.
- `GET /api/docs` -> HTML route documentation page.
- `PROPFIND /api/dav/*` -> `ListDavDirectoryUseCase.execute()` WebDAV-style directory listing.

### Local auth

- `GET /api/auth/status` -> `GetAuthStatusUseCase.execute()`.
- `POST /api/auth/bootstrap` -> `BootstrapLocalAccountUseCase.execute()`.
- `POST /api/auth/login` -> `LoginLocalAccountUseCase.execute()`.
- `POST /api/auth/logout` -> `LogoutLocalAccountUseCase.execute()`.
- `GET /api/auth/me` -> `GetCurrentUserUseCase.execute()`.
- `POST /api/auth/device-key` -> `CreateDeviceApiKeyUseCase.execute()`.
- `GET /api/auth/api-keys` -> `ListActiveApiKeysUseCase.execute()`.
- `DELETE /api/auth/api-keys/[id]` -> `RevokeApiKeyUseCase.execute()`.

### Z-Library

- `POST /api/zlibrary/login` -> `ZLibraryTokenLoginUseCase.execute()`.
- `POST /api/zlibrary/passwordLogin` -> `ZLibraryPasswordLoginUseCase.execute()`.
- `GET /api/zlibrary/logout` -> `ZLibraryLogoutUseCase.execute()`.
- `POST /api/zlibrary/search` -> `ZLibrarySearchUseCase.execute()`.
- `POST /api/zlibrary/download` -> `DownloadBookUseCase.execute()`.
- `POST /api/zlibrary/queue` -> `QueueDownloadUseCase.execute()`.
- `GET /api/zlibrary/queue` -> `GetQueueStatusUseCase.execute()`.

### Library files + listing

- `GET /api/library/list` -> `ListLibraryUseCase.execute()`.
- `GET /api/library/new?deviceId=...` -> `GetNewBooksForDeviceUseCase.execute()`.
- `GET /api/library/[title]` -> `GetLibraryFileUseCase.execute()`.
- `PUT /api/library/[title]` -> `PutLibraryFileUseCase.execute()`.
- `DELETE /api/library/[title]` -> `DeleteLibraryFileUseCase.execute()`.

### Library detail/state/metadata

- `GET /api/library/[id]/detail` -> `GetLibraryBookDetailUseCase.execute()`.
- `PUT /api/library/[id]/state` -> `UpdateLibraryBookStateUseCase.execute()`.
- `PUT /api/library/[id]/metadata` -> `UpdateLibraryBookMetadataUseCase.execute()`.
- `POST /api/library/[id]/refetch-metadata` -> `RefetchLibraryBookMetadataUseCase.execute()`.
- `PUT /api/library/[id]/rating` -> `UpdateBookRatingUseCase.execute()`.
- `GET /api/library/ratings` -> `ListLibraryRatingsUseCase.execute()`.

### Downloads confirmation/state

- `POST /api/library/confirmDownload` -> `ConfirmDownloadUseCase.execute()`.
- `DELETE /api/library/[id]/downloads` -> `ResetDownloadStatusUseCase.execute()`.
- `DELETE /api/library/[id]/downloads/[deviceId]` -> `RemoveDeviceDownloadUseCase.execute()`.

### Trash lifecycle

- `POST /api/library/[id]/trash` -> `MoveLibraryBookToTrashUseCase.execute()`.
- `DELETE /api/library/[id]/trash` -> `DeleteTrashedLibraryBookUseCase.execute()`.
- `GET /api/library/trash` -> `ListLibraryTrashUseCase.execute()`.
- `POST /api/library/[id]/restore` -> `RestoreLibraryBookUseCase.execute()`.

### Progress sync

- `GET /api/library/progress?fileName=...` -> `GetProgressUseCase.execute()`.
- `PUT /api/library/progress` -> `PutProgressUseCase.execute()`.
- `GET /api/library/progress/new?deviceId=...` -> `GetNewProgressForDeviceUseCase.execute()`.
- `POST /api/library/progress/confirm` -> `ConfirmProgressDownloadUseCase.execute()`.
- `GET /api/library/[id]/progress-history` -> `GetBookProgressHistoryUseCase.execute()`.

### KOReader plugin distribution

- `GET /api/plugin/koreader/latest` -> `GetLatestKoreaderPluginUseCase.execute()`.
- `GET /api/plugin/koreader/download` -> `GetKoreaderPluginDownloadUseCase.execute()`.

## 5) Function catalog (described)

## 5.1 Server lifecycle and HTTP utility functions

- `triggerTrashPurgeIfDue()` (`hooks.server.ts`): starts periodic purge job (6h cadence, single-flight guard).
- `triggerPluginSyncOnStartup()` (`hooks.server.ts`): startup-only KOReader plugin artifact/version sync.
- `requestLogHandle(...)`: per-request logger + request id propagation.
- `authHandle(...)`: enforces local-account sessions and device API keys on protected routes.
- `cookieHandle(...)`: injects cookie-based Z-Library credentials into `locals`.
- `apiOk(value)` (`http/api.ts`): wraps successful `ApiResult`.
- `apiError(message, status, cause)` (`http/api.ts`): wraps error `ApiResult`.
- `errorResponse(message, status)` (`http/api.ts`): standardized HTTP error payload `{"error": "..."}`.
- `getErrorMessage(cause, fallback)` (`http/api.ts`): extracts safe error string.
- `attempt(...)` (`http/api.ts`): generic wrapper for try/catch -> `ApiResult` conversion.
- `walkDir(dirPath)` (`routeCatalog.ts`): recursively finds `+server.ts` files.
- `filePathToApiPath(filePath, apiRoot)` (`routeCatalog.ts`): maps route file path to API URL.
- `extractMethods(fileContent)` (`routeCatalog.ts`): detects exported HTTP methods.
- `getApiRouteCatalog()` (`routeCatalog.ts`): route catalog model for docs and `_routes`.
- `renderHtml()` (`api/docs/+server.ts`): server-rendered route docs page.

## 5.2 Application service functions

- `EpubMetadataService.rewriteTitle(epubBuffer, title)`: validates EPUB structure, rewrites OPF/NCX title, rebuilds ZIP in spec-compliant order.
- `ExternalBookMetadataService.lookup(input)`: merges metadata from Google Books + Open Library.
- `ExternalBookMetadataService.lookupGoogleBooks(input)`: Google Books fetch/scoring selection logic.
- `ExternalBookMetadataService.lookupOpenLibrary(input)`: Open Library fetch/scoring selection logic.
- `ExternalBookMetadataService.extractAmazonAsin(identifier)`: best-effort ASIN extraction fallback.
- `KoreaderPluginArtifactService.buildArtifact()`: resolves plugin dir, reads version, zips plugin, computes SHA-256.
- `KoreaderPluginArtifactService.resolvePluginDir()`: candidate directory resolution.
- `KoreaderPluginArtifactService.readVersion(pluginDir)`: extracts version from `_meta.lua`.

## 5.3 Use-case `execute()` functions

- `ConfirmDownloadUseCase.execute(input)`: records device/book download confirmation.
- `ConfirmProgressDownloadUseCase.execute(input)`: marks per-device progress-download watermark.
- `DeleteLibraryFileUseCase.execute(title)`: deletes a file object in storage.
- `DeleteTrashedLibraryBookUseCase.execute(input)`: hard-deletes trashed book row + file/progress blobs.
- `DownloadBookUseCase.execute(input)`: validates Z-Library credentials, downloads file, optionally uploads/stores metadata, optionally returns file to caller.
- `GetBookProgressHistoryUseCase.execute(input)`: returns ordered progress history entries for a book.
- `GetKoreaderPluginDownloadUseCase.execute()`: resolves latest plugin release then streams artifact bytes.
- `GetLatestKoreaderPluginUseCase.execute()`: fetches latest plugin metadata from DB.
- `GetLibraryBookDetailUseCase.execute(input)`: aggregate book + download/device details for modal/detail view.
- `GetLibraryFileUseCase.execute(title)`: fetches file blob by storage key/title.
- `GetNewBooksForDeviceUseCase.execute(deviceId)`: returns books not yet acknowledged by device.
- `GetNewProgressForDeviceUseCase.execute(deviceId)`: returns books whose progress changed since device watermark.
- `GetProgressUseCase.execute(input)`: resolves and returns KOReader progress metadata file.
- `GetQueueStatusUseCase.execute()`: returns queue counts and task snapshots.
- `ListDavDirectoryUseCase.execute(input)`: transforms object listing to DAV XML multistatus.
- `ListLibraryRatingsUseCase.execute()`: returns publicly readable rated books list.
- `ListLibraryTrashUseCase.execute()`: returns soft-deleted books.
- `ListLibraryUseCase.execute()`: returns active library books list.
- `MoveLibraryBookToTrashUseCase.execute(input)`: soft-delete with expiration timestamp.
- `PurgeExpiredTrashUseCase.execute(nowIso)`: deletes expired trash rows and associated storage.
- `PutLibraryFileUseCase.execute(title, body)`: uploads raw file and creates book entry.
- `PutProgressUseCase.execute(input)`: validates/merges uploaded progress; updates book + history + device watermark.
- `QueueDownloadUseCase.execute(input)`: enqueues background download task.
- `RefetchLibraryBookMetadataUseCase.execute(input)`: pulls external metadata and fills missing fields.
- `RemoveDeviceDownloadUseCase.execute(input)`: removes one device-download acknowledgment.
- `ResetDownloadStatusUseCase.execute(bookId)`: clears all download acknowledgments for a book.
- `RestoreLibraryBookUseCase.execute(input)`: restores soft-deleted book.
- `SyncKoreaderPluginReleaseUseCase.execute()`: syncs local plugin source -> zipped artifact in R2 -> `PluginReleases` DB latest marker.
- `UpdateBookRatingUseCase.execute(input)`: validates and stores manual rating.
- `UpdateLibraryBookMetadataUseCase.execute(input)`: validates and updates metadata fields.
- `UpdateLibraryBookStateUseCase.execute(input)`: applies read/archive/exclude toggles and related progress state adjustments.
- `ZLibraryLogoutUseCase.execute()`: clears runtime Z-Library context result.
- `ZLibraryPasswordLoginUseCase.execute(request)`: delegates email/password login.
- `ZLibrarySearchUseCase.execute(input)`: verifies token credentials then searches.
- `ZLibraryTokenLoginUseCase.execute(request)`: token validation/login probe.

## 5.4 Domain function catalog

- `isIncomingProgressOlder(existingLatest, incomingLatest)` (`ProgressConflictPolicy.ts`): prevents stale progress overwrite.
- `extractSummaryModified(content)` (`ProgressFile.ts`): parses date from Lua metadata.
- `extractPercentFinished(content)` (`ProgressFile.ts`): parses percent from Lua metadata.
- `buildProgressFileDescriptor(title)` (`ProgressFile.ts`): derives `.sdr/metadata.*.lua` path from file title.
- `normalizeProgressLookupTitle(targetTitle)` (`ProgressFile.ts`): legacy title normalization for lookup fallback.
- `buildProgressLookupTitleCandidates(targetTitle)` (`ProgressFile.ts`): candidate set for tolerant matching.
- `sanitizeLibraryStorageKey(rawKey, fallback)` (`StorageKeySanitizer.ts`): path-safe normalized file key.
- `buildSanitizedBookFileName(title, bookId, extension)` (`StorageKeySanitizer.ts`): normalized deterministic storage filename.

## 5.5 Infrastructure function catalog

### Repositories

- `BookRepository`: full CRUD + state transitions + filtered queries for downloads/progress/trash.
  Methods: `getAll`, `getById`, `getByIdIncludingTrashed`, `getByZLibId`, `getByStorageKey`, `getByTitleAndExtension`, `getByTitle`, `create`, `updateMetadata`, `delete`, `resetDownloadStatus`, `updateProgress`, `updateRating`, `updateState`, `getNotDownloadedByDevice`, `getBooksWithNewProgressForDevice`, `getTrashed`, `moveToTrash`, `restoreFromTrash`, `getExpiredTrash`, `count`.
- `DeviceDownloadRepository`: `getAll`, `getByDevice`, `getByBookId`, `create`, `deleteByBookIdAndDeviceId`, `delete`.
- `DeviceProgressDownloadRepository`: `upsertByDeviceAndBook`.
- `BookProgressHistoryRepository`: `appendSnapshot`, `getByBookId`.
- `PluginReleaseRepository`: `upsert`, `setLatestVersion`, `getLatest`.

### Storage and external client

- `S3Storage.put/get/delete/list`: R2 object operations.
- `DavUploadService.upload(fileName, data)`: stores under `library/` prefix via `StoragePort`.
- `ZLibraryClient.search/download/passwordLogin/tokenLogin/signup`: Z-Library protocol adapter.
- `toUrlEncoded(data)`: form-urlencode helper.

### Queue

- `DownloadQueue.enqueue(task)`: task creation + queue kickoff.
- `DownloadQueue.getStatus()`: queued/processing counters.
- `DownloadQueue.getTasks()`: chronological task snapshots.
- `DownloadQueue.processQueue()`: single-worker queue consumer.
- `DownloadQueue.processTask(task)`: retry/backoff wrapper around `DownloadBookUseCase`.
- `DownloadQueue.isRetryableFailure(statusCode, message)`: retry classification.
- `DownloadQueue.getRetryDelayMs(attempt)`: exponential delay schedule.
- `DownloadQueue.cleanupFinishedTasks()`: retention pruning.

### Logging helpers

- `resolveLogLevel()`.
- `toLogError(error)`.
- `createChildLogger(bindings)`.
- `getRequestLogger(locals)`.

## 5.6 Client-side public function catalog (`src/lib/client`)

### Base/auth

- `get(endpoint)`: authenticated GET wrapper with typed `Result`.
- `post(endpoint, body)`: authenticated POST wrapper with typed `Result`.

### Auth services

- `AuthService.getStatus()`.
- `AuthService.bootstrap(credentials)`.
- `AuthService.login(credentials)`.
- `AuthService.restoreSession()`.
- `AuthService.logout()`.
- `ZLibAuthService.passwordLogin(email, password)`.
- `ZLibAuthService.tokenLogin(userId, userKey)`.
- `ZLibAuthService.getStoredUserName()`.
- `ZLibAuthService.storeUserName(name)`.
- `ZLibAuthService.clearUserName()`.
- `ZLibAuthService.isLoggedIn()`.

### Route wrappers (all exposed through `ZUI` facade)

- `authCheck()`.
- `searchBook(request)`.
- `passwordLogin(request)`.
- `tokenLogin(request)`.
- `downloadBook(book, options)`.
- `queueToLibrary(book)`.
- `getQueueStatus()`.
- `getLibrary()`.
- `getLibraryTrash()`.
- `getLibraryBookDetail(bookId)`.
- `getLibraryBookProgressHistory(bookId)`.
- `refetchLibraryBookMetadata(bookId)`.
- `removeLibraryBookDeviceDownload(bookId, deviceId)`.
- `resetDownloadStatus(bookId)`.
- `moveLibraryBookToTrash(bookId)`.
- `restoreLibraryBook(bookId)`.
- `deleteTrashedLibraryBook(bookId)`.
- `downloadLibraryBookFile(storageKey, fileName)`.
- `uploadLibraryBookFile(file)`.
- `updateLibraryBookRating(bookId, rating)`.
- `getLibraryRatings()`.
- `updateLibraryBookState(bookId, request)`.
- `updateLibraryBookMetadata(bookId, request)`.

### Client store

- `ToastStore.add(message, type, duration)`.
- `ToastStore.remove(id)`.

## 5.7 Frontend route/component function catalog

### Pages

- `src/routes/+page.svelte`: `handleLogin`, `handleKeyDown`.
- `src/routes/+layout.svelte`: `openModal`, `closeModal`, `handleLogin`, `handleLogout`, `handleSidebarToggle`, `toggleMobileSidebar`, `handleKeyDown`, `handleModalClick`.
- `src/routes/search/+page.svelte`: `searchBooks`, `handleDownload`, `handleShare`, `openTitleAdjustModal`, `closeTitleAdjustModal`, `confirmTitleAdjustAction`, `handleKeyDown`.
- `src/routes/queue/+page.svelte`: `refreshQueueStatus`, `formatQueueDate`.
- `src/routes/library/+page.svelte`: comprehensive library and detail-modal function set including fetch/sort/view-switch, metadata editing, rating/read/archive toggles, progress history load/formatting, trash/restore/delete flows, download/upload actions.

### Components

- `DropDown.svelte`: `handleChange`.
- `Sidebar.svelte`: `isActive`, `handleToggle`.
- `Toast.svelte`: `dismiss`.

## 5.8 KOReader plugin function catalog (`koreaderPlugins`)

All plugin logger messages in `sake.koplugin` correctly use `[Sake]` prefix.

### `sake.koplugin`

- `SakeDevice.ensure(settings)` / `Device.ensure(settings)`: ensures persistent device id.
- `Settings.load/saveKey/saveField/validateRequired/keyFor`: plugin setting lifecycle and validation.
- `Utils.formatSize/sanitizeFilename/basename`: utility helpers.
- `Menu.addToMainMenu(menu_items, ctx)`: menu wiring.
- `Dialogs.showStringInput(ctx, field, title)`: settings input UI dialog.
- `Client.authHeader/request/errorFromBody`: HTTP utility primitives.
- `BookApi.fetchBookList/fetchBookContent/confirmDownload`: new-book sync and confirmation API operations.
- `ProgressApi.uploadProgress/downloadProgress/getNewProgressForDevice/confirmProgressDownload`: progress sync API operations.
- `Sake` lifecycle and sync functions:
  - `startDeferredProgressWatcher`, `runProgressSync`, `checkPluginUpdate`, `performPluginUpdate`, `onDispatcherRegisterActions`, `init`, `addToMainMenu`, `handleSuspend`, `handleResume`, `onReaderReady`.
- `BookSync` class functions (book synchronization pipeline):
  - constructor `new`, validation, popup/error handling, download/store/confirm orchestration.
- `ProgressSync` class functions (progress synchronization pipeline):
  - constructor `new`, validation, doc path discovery, live percent extraction, metadata read/write, conflict-aware apply/confirm flows.

### `sakeUpdater.koplugin`

- `SakeUpdaterPlugin:init()`: plugin bootstrap placeholder.
- Updater helpers: `normalizedBaseUrl`, `shellQuote`, `authHeader`, `request`, `parseVersion`, `isVersionGreater`, `readSakeVersion`.
- `Updater:new/isUpdateAvailable/getLatestVersion/getCurrentVersion/checkForUpdate/performUpdate`: version check + zip download + unpack + plugin replacement flow.

## 6) Non-functional analysis

- Strong separation of concerns is present and mostly consistent.
- API error contract is consistent (`{"error":"..."}`).
- Typed `Result` pattern is used across server and client wrappers.
- Queue has retry logic and retention cleanup but is in-memory only (process-local).
- Plugin distribution flow is robust: build -> hash -> upload-if-missing -> DB latest marker.
- Public endpoint exception exists intentionally for ratings (`/api/library/ratings`).

## 7) Key risks and tradeoffs observed

- In-memory queue (`downloadQueue`) does not survive restarts and is single-instance only.
- Some route/service files include legacy/duplicated patterns (example: remote command handler and both `device.lua`/`sake_device.lua`).
- Large frontend page modules (notably library page) bundle significant UI logic in single files.
- External metadata enrichment depends on third-party availability and loose matching heuristics.

## 8) Quick inventory by folder

- `z-ui/src/routes`: UI pages + API controllers.
- `z-ui/src/lib/server/application`: use-cases/services/composition.
- `z-ui/src/lib/server/domain`: entities/value rules.
- `z-ui/src/lib/server/infrastructure`: DB, repositories, queue, storage, external client.
- `z-ui/src/lib/client`: browser API SDK facade, auth services, store.
- `koreaderPlugins/sake.koplugin`: KOReader sync plugin.
- `koreaderPlugins/sakeUpdater.koplugin`: KOReader self-updater helper plugin.
- `z-ui-bruno`: API request collection for test/manual operations.
