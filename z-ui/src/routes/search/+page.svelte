<script lang="ts">
	import type { ZBook } from "$lib/types/ZLibrary/ZBook";
	import type { ZSearchBookRequest } from "$lib/types/ZLibrary/Requests/ZSearchBookRequest";
	import type { ApiError } from "$lib/types/ApiError";
	import type { LookupSearchBookMetadataResponse } from "$lib/client/routes/lookupSearchBookMetadata";
	import DropDown from "$lib/components/DropDown.svelte";
	import Loading from "$lib/components/Loading.svelte";
	import BookCard from "$lib/components/BookCard.svelte";
	import { ZUI } from "$lib/client/zui";

	import { toastStore } from "$lib/client/stores/toastStore.svelte";

	let title = $state("");
	let lang = $state("german");
	let format = $state("epub");
	let books = $state<ZBook[]>([]);
	let isLoading = $state(false);
	let isDownloading = $state(false);
	let downloadingBook = $state<string | null>(null);
	let error = $state<ApiError | null>(null);
	let showTitleAdjustModal = $state(false);
	let pendingBookAction = $state<"download" | "library" | null>(null);
	let pendingBook = $state<ZBook | null>(null);
	let adjustedTitle = $state("");
	let selectedBookForDetails = $state<ZBook | null>(null);
	let detailMetadataByBookId = $state<
		Record<number, LookupSearchBookMetadataResponse["metadata"]>
	>({});
	let detailMetadataLoadingByBookId = $state<Record<number, boolean>>({});
	let detailMetadataErrorByBookId = $state<Record<number, string | null>>({});

	async function searchBooks() {
		if (!title.trim()) return;

		isLoading = true;
		error = null;

		const payload: ZSearchBookRequest = {
			searchText: title,
			languages: [lang],
			extensions: [format],
		};

		const result = await ZUI.searchBook(payload);

		if (result.ok) {
			books = result.value.books;
		} else {
			error = result.error;
			books = [];
		}

		isLoading = false;
	}

	async function handleDownload(book: ZBook) {
		isDownloading = true;
		downloadingBook = book.title;
		
		const result = await ZUI.downloadBook(book, { downloadToDevice: true });
		
		isDownloading = false;
		downloadingBook = null;
		
		if (!result.ok) {
			error = result.error;
			toastStore.add(`Download failed: ${result.error.message}`, "error");
		} else {
			toastStore.add(`Download started for "${book.title}"`, "success");
		}
	}

	async function handleShare(book: ZBook) {
		// Queue the book for async download to library - returns immediately
		const result = await ZUI.queueToLibrary(book);
		
		if (!result.ok) {
			error = result.error;
			toastStore.add(
				`Failed to add to library: ${result.error.message}`,
				"error",
			);
		} else {
			const queueInfo = result.value.queueStatus.pending > 0 
				? ` (${result.value.queueStatus.pending} in queue)`
				: '';
			toastStore.add(`"${book.title}" added to download queue${queueInfo}`, "success");
		}
	}

	function openTitleAdjustModal(book: ZBook, action: "download" | "library"): void {
		selectedBookForDetails = null;
		pendingBook = book;
		pendingBookAction = action;
		adjustedTitle = book.title;
		showTitleAdjustModal = true;
	}

	function closeTitleAdjustModal(): void {
		showTitleAdjustModal = false;
		pendingBook = null;
		pendingBookAction = null;
		adjustedTitle = "";
	}

	async function confirmTitleAdjustAction(): Promise<void> {
		if (!pendingBook || !pendingBookAction) {
			return;
		}

		const finalTitle = adjustedTitle.trim();
		if (!finalTitle) {
			toastStore.add("Title cannot be empty", "error");
			return;
		}

		const bookWithAdjustedTitle: ZBook = {
			...pendingBook,
			title: finalTitle
		};
		const action = pendingBookAction;
		closeTitleAdjustModal();

		if (action === "download") {
			await handleDownload(bookWithAdjustedTitle);
			return;
		}

		await handleShare(bookWithAdjustedTitle);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			searchBooks();
		}
	}

	function openSearchBookDetails(book: ZBook): void {
		selectedBookForDetails = book;
		if (!detailMetadataByBookId[book.id] && !detailMetadataLoadingByBookId[book.id]) {
			void loadSearchBookMetadata(book);
		}
	}

	function closeSearchBookDetails(): void {
		selectedBookForDetails = null;
	}

	async function loadSearchBookMetadata(book: ZBook): Promise<void> {
		detailMetadataLoadingByBookId = {
			...detailMetadataLoadingByBookId,
			[book.id]: true
		};
		detailMetadataErrorByBookId = {
			...detailMetadataErrorByBookId,
			[book.id]: null
		};

		const result = await ZUI.lookupSearchBookMetadata({
			title: book.title,
			author: book.author,
			identifier: book.identifier,
			language: book.language
		});

		if (!result.ok) {
			detailMetadataErrorByBookId = {
				...detailMetadataErrorByBookId,
				[book.id]: result.error.message
			};
			detailMetadataLoadingByBookId = {
				...detailMetadataLoadingByBookId,
				[book.id]: false
			};
			return;
		}

		detailMetadataByBookId = {
			...detailMetadataByBookId,
			[book.id]: result.value.metadata
		};
		detailMetadataLoadingByBookId = {
			...detailMetadataLoadingByBookId,
			[book.id]: false
		};
	}

	function displayValue(value: string | number | null | undefined): string {
		if (value === null || value === undefined) {
			return "Not available";
		}
		if (typeof value === "number") {
			return Number.isFinite(value) ? String(value) : "Not available";
		}
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : "Not available";
	}

	function extractIsbn(identifier: string | null | undefined): string | null {
		if (!identifier) {
			return null;
		}

		const matches = identifier.match(/(?:97[89][-\s]?(?:\d[-\s]?){10}|(?:\d[-\s]?){9}[\dXx])/g);
		if (!matches) {
			return null;
		}

		for (const match of matches) {
			const normalized = match.replace(/[^0-9Xx]/g, "").toUpperCase();
			if (normalized.length === 13 || normalized.length === 10) {
				return normalized;
			}
		}

		return null;
	}

	function toGoogleBooksUrl(googleBooksId: string | null | undefined): string | null {
		const id = googleBooksId?.trim();
		if (!id) {
			return null;
		}
		return `https://books.google.com/books?id=${encodeURIComponent(id)}`;
	}

	function toOpenLibraryUrl(openLibraryKey: string | null | undefined): string | null {
		const key = openLibraryKey?.trim();
		if (!key) {
			return null;
		}
		const normalized = key.startsWith("/") ? key : `/${key}`;
		return `https://openlibrary.org${normalized}`;
	}

	async function copyText(value: string, label: string): Promise<void> {
		const text = value.trim();
		if (!text) {
			toastStore.add(`No ${label} to copy`, "error");
			return;
		}

		try {
			if (typeof navigator !== "undefined" && navigator.clipboard) {
				await navigator.clipboard.writeText(text);
			} else if (typeof document !== "undefined") {
				const textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.style.position = "fixed";
				textarea.style.opacity = "0";
				document.body.append(textarea);
				textarea.select();
				const ok = document.execCommand("copy");
				document.body.removeChild(textarea);
				if (!ok) {
					throw new Error("copy command failed");
				}
			} else {
				throw new Error("clipboard unavailable");
			}
			toastStore.add(`${label} copied`, "success");
		} catch {
			toastStore.add(`Failed to copy ${label}`, "error");
		}
	}

</script>

<div class="search-page">
	<Loading bind:show={isLoading} />

	{#if isDownloading}
		<div class="download-overlay">
			<div class="download-modal">
				<div class="download-spinner"></div>
				<div class="download-content">
					<h3>Downloading...</h3>
					{#if downloadingBook}
						<p class="download-title">{downloadingBook}</p>
					{/if}
					<p class="download-hint">Please wait while we fetch your book</p>
				</div>
			</div>
		</div>
	{/if}

	<header class="page-header">
		<h1>Search Books</h1>
		<p>Find and download books from Z-Library</p>
	</header>

	<div class="search-container">
		<div class="search-bar">
			<svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
			<input
				type="text"
				placeholder="Search by title, author, or ISBN..."
				bind:value={title}
				onkeydown={handleKeyDown}
			/>
			<button class="search-btn" onclick={searchBooks} disabled={!title.trim()}>
				Search
			</button>
		</div>

		<div class="search-filters">
			<div class="filter-group">
				<label for="search-language">Language</label>
				<DropDown
					id="search-language"
					bind:selected={lang}
					options={["english", "german", "french", "spanish"]}
				/>
			</div>
			<div class="filter-group">
				<label for="search-format">Format</label>
				<DropDown
					id="search-format"
					bind:selected={format}
					options={["epub", "mobi", "pdf"]}
				/>
			</div>
		</div>
	</div>

	{#if error}
		<div class="error">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"></circle>
				<line x1="12" y1="8" x2="12" y2="12"></line>
				<line x1="12" y1="16" x2="12.01" y2="16"></line>
			</svg>
			<p>{error.message}</p>
		</div>
	{/if}

	<div class="results">
		{#if books.length > 0}
			<div class="results-header">
				<span class="results-count">{books.length} result{books.length !== 1 ? 's' : ''} found</span>
			</div>
			<div class="book-list">
				{#each books as book (book.id)}
					<BookCard
						{book}
						onDownload={(selected) => openTitleAdjustModal(selected, "download")}
						onShare={(selected) => openTitleAdjustModal(selected, "library")}
						onOpenDetails={openSearchBookDetails}
					/>
				{/each}
			</div>
		{:else if !isLoading && title}
			<div class="empty-state">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"></circle>
					<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
					<line x1="8" y1="11" x2="14" y2="11"></line>
				</svg>
				<h3>No books found</h3>
				<p>Try adjusting your search terms or filters</p>
			</div>
		{:else if !isLoading}
			<div class="empty-state initial">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
					<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
				</svg>
				<h3>Search for books</h3>
				<p>Enter a title, author, or ISBN to get started</p>
			</div>
		{/if}
	</div>
</div>

{#if showTitleAdjustModal && pendingBook}
	<div
		class="title-adjust-modal-overlay"
		role="button"
		tabindex="0"
		aria-label="Close title adjustment modal"
		onclick={closeTitleAdjustModal}
		onkeydown={(event) => event.key === "Escape" && closeTitleAdjustModal()}
	>
		<div
			class="title-adjust-modal-content"
			role="dialog"
			aria-modal="true"
			aria-labelledby="title-adjust-heading"
			tabindex="-1"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.stopPropagation()}
		>
			<h3 id="title-adjust-heading">Adjust Book Title</h3>
			<p class="title-adjust-description">
				This title will be used for the filename and reader metadata.
			</p>
			<label class="title-adjust-label" for="adjusted-book-title">Title</label>
			<input
				id="adjusted-book-title"
				type="text"
				bind:value={adjustedTitle}
				placeholder="Book title"
			/>
			<div class="title-adjust-actions">
				<button type="button" class="title-adjust-cancel" onclick={closeTitleAdjustModal}>
					Cancel
				</button>
				<button
					type="button"
					class="title-adjust-confirm"
					onclick={confirmTitleAdjustAction}
				>
					{pendingBookAction === "download" ? "Download" : "Add To Library"}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if selectedBookForDetails}
	{@const detailBook = selectedBookForDetails}
	{@const detailMetadata = detailMetadataByBookId[detailBook.id]}
	{@const isDetailMetadataLoading = detailMetadataLoadingByBookId[detailBook.id] ?? false}
	{@const detailMetadataError = detailMetadataErrorByBookId[detailBook.id]}
	{@const identifier = detailMetadata?.identifier ?? detailBook.identifier}
	{@const isbn = extractIsbn(identifier)}
	{@const googleBooksUrl = toGoogleBooksUrl(detailMetadata?.googleBooksId)}
	{@const openLibraryUrl = toOpenLibraryUrl(detailMetadata?.openLibraryKey)}
	{@const amazonAsin = detailMetadata?.amazonAsin ?? null}
	<div
		class="search-detail-modal-overlay"
		role="button"
		tabindex="0"
		aria-label="Close search result details"
		onclick={closeSearchBookDetails}
		onkeydown={(event) => event.key === "Escape" && closeSearchBookDetails()}
	>
		<div
			class="search-detail-modal-content"
			role="dialog"
			aria-modal="true"
			aria-labelledby="search-detail-heading"
			tabindex="-1"
			onclick={(event) => event.stopPropagation()}
			onkeydown={(event) => event.stopPropagation()}
		>
			<div class="search-detail-header">
				<div>
					<h3 id="search-detail-heading">{detailBook.title}</h3>
					<p class="search-detail-author">by {displayValue(detailBook.author)}</p>
				</div>
				<button type="button" class="search-detail-close-btn" onclick={closeSearchBookDetails} aria-label="Close details">
					✕
				</button>
			</div>

			{#if isDetailMetadataLoading}
				<div class="search-detail-meta-status">
					<span>Fetching metadata from Google Books and OpenLibrary...</span>
				</div>
			{:else if detailMetadataError}
				<div class="search-detail-meta-status search-detail-meta-status-error">
					<span>{detailMetadataError}</span>
					<button type="button" class="copy-btn" onclick={() => void loadSearchBookMetadata(detailBook)}>
						Retry
					</button>
				</div>
			{/if}

			<div class="search-detail-grid">
				<div class="search-detail-row">
					<span class="label">Format</span>
					<span class="value">{displayValue(detailBook.extension).toUpperCase()}</span>
				</div>
				<div class="search-detail-row">
					<span class="label">Language</span>
					<span class="value">{displayValue(detailBook.language)}</span>
				</div>
				<div class="search-detail-row">
					<span class="label">Year</span>
					<span class="value">{displayValue(detailBook.year)}</span>
				</div>
				<div class="search-detail-row">
					<span class="label">Pages</span>
					<span class="value">{displayValue(detailMetadata?.pages ?? detailBook.pages)}</span>
				</div>
				<div class="search-detail-row">
					<span class="label">Filesize</span>
					<span class="value">{displayValue(detailBook.filesizeString)}</span>
				</div>
				<div class="search-detail-row">
					<span class="label">Publisher</span>
					<span class="value">{displayValue(detailMetadata?.publisher ?? detailBook.publisher)}</span>
				</div>
				<div class="search-detail-row">
					<span class="label">Series</span>
					<span class="value">{displayValue(detailMetadata?.series ?? detailBook.series)}</span>
				</div>
				<div class="search-detail-row">
					<span class="label">Volume</span>
					<span class="value">{displayValue(detailMetadata?.volume ?? detailBook.volume)}</span>
				</div>
				<div class="search-detail-row">
					<span class="label">Edition</span>
					<span class="value">{displayValue(detailMetadata?.edition ?? detailBook.edition)}</span>
				</div>
				<div class="search-detail-row">
					<span class="label">ISBN</span>
					<div class="value with-action">
						<span>{displayValue(isbn)}</span>
						{#if isbn}
							<button type="button" class="copy-btn" onclick={() => void copyText(isbn, "ISBN")}>
								Copy
							</button>
						{/if}
					</div>
				</div>
				<div class="search-detail-row">
					<span class="label">Identifier</span>
					<div class="value with-action">
						<span>{displayValue(identifier)}</span>
						{#if identifier}
							<button type="button" class="copy-btn" onclick={() => void copyText(identifier, "Identifier")}>
								Copy
							</button>
						{/if}
					</div>
				</div>
				<div class="search-detail-row">
					<span class="label">Google Books</span>
					<div class="value with-action">
						<span>{displayValue(detailMetadata?.googleBooksId)}</span>
						{#if googleBooksUrl}
							<a class="external-link-btn" href={googleBooksUrl} target="_blank" rel="noopener noreferrer">
								Open
							</a>
						{/if}
					</div>
				</div>
				<div class="search-detail-row">
					<span class="label">OpenLibrary</span>
					<div class="value with-action">
						<span>{displayValue(detailMetadata?.openLibraryKey)}</span>
						{#if openLibraryUrl}
							<a class="external-link-btn" href={openLibraryUrl} target="_blank" rel="noopener noreferrer">
								Open
							</a>
						{/if}
					</div>
				</div>
				<div class="search-detail-row">
					<span class="label">ASIN</span>
					<div class="value with-action">
						<span>{displayValue(amazonAsin)}</span>
						{#if amazonAsin}
							<button type="button" class="copy-btn" onclick={() => void copyText(amazonAsin, "ASIN")}>
								Copy
							</button>
						{/if}
					</div>
				</div>
				<div class="search-detail-row">
					<span class="label">External Rating</span>
					<span class="value">
						{#if detailMetadata?.externalRating !== null && detailMetadata?.externalRating !== undefined}
							{detailMetadata.externalRating}
							{#if detailMetadata.externalRatingCount !== null && detailMetadata.externalRatingCount !== undefined}
								({detailMetadata.externalRatingCount} ratings)
							{/if}
						{:else}
							Not available
						{/if}
					</span>
				</div>
			</div>

			{#if detailMetadata?.description ?? detailBook.description}
				<div class="search-detail-description">
					<h4>Description</h4>
					<p>{detailMetadata?.description ?? detailBook.description}</p>
				</div>
			{/if}

			<div class="search-detail-actions">
				<button type="button" class="search-detail-primary" onclick={() => openTitleAdjustModal(detailBook, "download")}>
					Download
				</button>
				<button type="button" class="search-detail-secondary" onclick={() => openTitleAdjustModal(detailBook, "library")}>
					Add to Library
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.search-page {
		padding: 1rem 0 1.4rem;
		display: grid;
		gap: 1rem;
		color: var(--color-text-primary);
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
	}

	.page-header h1 {
		margin: 0 0 0.24rem;
		font-size: 1.45rem;
		font-weight: 600;
	}

	.page-header p {
		margin: 0;
		font-size: 0.84rem;
		color: var(--color-text-muted);
	}

	.search-container {
		padding: 0.9rem;
		border-radius: 0.8rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		display: grid;
		gap: 0.72rem;
	}

	.search-bar {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.55rem;
		padding: 0.28rem 0.32rem 0.28rem 0.68rem;
		border-radius: 0.62rem;
		border: 1px solid var(--color-border);
		background: #1a1d27;
	}

	.search-bar:focus-within {
		border-color: rgba(201, 169, 98, 0.56);
		box-shadow: 0 0 0 2px rgba(201, 169, 98, 0.15);
	}

	.search-icon {
		color: var(--color-text-muted);
	}

	.search-bar input {
		border: 0;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 0.87rem;
		padding: 0.46rem 0;
		font-family: inherit;
	}

	.search-bar input:focus {
		outline: none;
	}

	.search-bar input::placeholder {
		color: var(--color-text-muted);
	}

	.search-btn {
		padding: 0.5rem 0.82rem;
		border-radius: 0.52rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		font-size: 0.74rem;
		font-weight: 600;
		cursor: pointer;
	}

	.search-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.search-filters {
		display: flex;
		gap: 0.85rem;
		flex-wrap: wrap;
		padding-top: 0.7rem;
		border-top: 1px solid var(--color-border);
	}

	.filter-group {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.filter-group label {
		font-size: 0.72rem;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.results {
		display: grid;
		gap: 0.55rem;
	}

	.results-count {
		font-size: 0.76rem;
		color: var(--color-text-muted);
	}

	.book-list {
		display: grid;
		gap: 0.55rem;
	}

	.empty-state {
		display: grid;
		justify-items: center;
		text-align: center;
		padding: 2rem 1rem;
		border: 1px dashed var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
	}

	.empty-state svg {
		margin-bottom: 0.6rem;
		color: var(--color-text-muted);
	}

	.empty-state h3 {
		margin: 0 0 0.24rem;
		font-size: 1rem;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.82rem;
		color: var(--color-text-muted);
	}

	.error {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.7rem;
		border-radius: 0.62rem;
		border: 1px solid rgba(196, 68, 58, 0.45);
		background: rgba(196, 68, 58, 0.16);
		font-size: 0.78rem;
		color: #ffb4ad;
	}

	.error p {
		margin: 0;
	}

	.title-adjust-modal-overlay,
	.search-detail-modal-overlay,
	.download-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		padding: 1rem;
		z-index: 1200;
	}

	.title-adjust-modal-content,
	.search-detail-modal-content,
	.download-modal {
		width: min(520px, 100%);
		border-radius: 0.92rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 1rem;
		box-shadow: 0 20px 42px -30px rgba(0, 0, 0, 0.9);
	}

	.title-adjust-modal-content {
		display: grid;
		gap: 0.55rem;
	}

	.search-detail-modal-content {
		width: min(760px, 100%);
		max-height: min(86vh, 860px);
		display: grid;
		gap: 0.85rem;
		overflow: auto;
	}

	.search-detail-header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.search-detail-meta-status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.5rem 0.62rem;
		border-radius: 0.52rem;
		border: 1px solid var(--color-border);
		background: #1a1d27;
		font-size: 0.76rem;
		color: var(--color-text-secondary);
	}

	.search-detail-meta-status-error {
		border-color: rgba(196, 68, 58, 0.45);
		background: rgba(196, 68, 58, 0.12);
		color: #ffb4ad;
	}

	.search-detail-header h3 {
		margin: 0;
		font-size: 1.04rem;
	}

	.search-detail-author {
		margin: 0.22rem 0 0;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.search-detail-close-btn {
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 0.45rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.search-detail-close-btn:hover {
		color: var(--color-text-primary);
		border-color: rgba(255, 255, 255, 0.18);
	}

	.search-detail-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem 0.8rem;
	}

	.search-detail-row {
		display: grid;
		gap: 0.2rem;
		padding: 0.48rem 0.56rem;
		border-radius: 0.5rem;
		background: #1a1d27;
		border: 1px solid var(--color-border);
		min-width: 0;
	}

	.search-detail-row .label {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.search-detail-row .value {
		font-size: 0.8rem;
		color: var(--color-text-primary);
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.search-detail-row .value.with-action {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.search-detail-row .value.with-action span {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.copy-btn {
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
		border-radius: 0.38rem;
		padding: 0.18rem 0.44rem;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
		flex-shrink: 0;
	}

	.copy-btn:hover {
		color: var(--color-text-primary);
		border-color: rgba(255, 255, 255, 0.18);
	}

	.external-link-btn {
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
		border-radius: 0.38rem;
		padding: 0.18rem 0.44rem;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		flex-shrink: 0;
	}

	.external-link-btn:hover {
		color: var(--color-text-primary);
		border-color: rgba(255, 255, 255, 0.18);
	}

	.search-detail-description {
		display: grid;
		gap: 0.28rem;
		padding: 0.62rem 0.66rem;
		border-radius: 0.58rem;
		border: 1px solid var(--color-border);
		background: #1a1d27;
	}

	.search-detail-description h4 {
		margin: 0;
		font-size: 0.82rem;
	}

	.search-detail-description p {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--color-text-secondary);
		white-space: pre-wrap;
	}

	.search-detail-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.44rem;
		justify-content: flex-end;
	}

	.search-detail-primary,
	.search-detail-secondary {
		padding: 0.46rem 0.7rem;
		border-radius: 0.52rem;
		border: 1px solid var(--color-border);
		font-size: 0.74rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}

	.search-detail-primary {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
	}

	.search-detail-secondary {
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
	}

	.title-adjust-modal-content h3 {
		margin: 0;
		font-size: 1rem;
	}

	.title-adjust-description {
		margin: 0;
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	.title-adjust-label {
		font-size: 0.72rem;
		color: var(--color-text-secondary);
	}

	.title-adjust-modal-content input {
		width: 100%;
		padding: 0.6rem 0.68rem;
		border-radius: 0.54rem;
		border: 1px solid var(--color-border);
		background: #1a1d27;
		color: var(--color-text-primary);
		font-size: 0.82rem;
		font-family: inherit;
	}

	.title-adjust-modal-content input:focus {
		outline: none;
		border-color: rgba(201, 169, 98, 0.56);
		box-shadow: 0 0 0 2px rgba(201, 169, 98, 0.15);
	}

	.title-adjust-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.4rem;
	}

	.title-adjust-cancel,
	.title-adjust-confirm {
		padding: 0.5rem 0.72rem;
		border-radius: 0.52rem;
		border: 1px solid var(--color-border);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}

	.title-adjust-cancel {
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
	}

	.title-adjust-confirm {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
	}

	.download-modal {
		display: grid;
		justify-items: center;
		gap: 0.8rem;
		text-align: center;
		max-width: 380px;
	}

	.download-spinner {
		width: 42px;
		height: 42px;
		border: 3px solid rgba(201, 169, 98, 0.25);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}

	.download-content {
		display: grid;
		gap: 0.3rem;
	}

	.download-content h3 {
		margin: 0;
		font-size: 1.05rem;
	}

	.download-title {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 260px;
	}

	.download-hint {
		margin: 0;
		font-size: 0.76rem;
		color: var(--color-text-muted);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 640px) {
		.page-header {
			align-items: flex-start;
			flex-direction: column;
		}

		.page-header h1 {
			font-size: 1.22rem;
		}

		.search-bar {
			grid-template-columns: auto minmax(0, 1fr);
			padding: 0.4rem 0.45rem 0.45rem 0.55rem;
			gap: 0.45rem;
		}

		.search-btn {
			grid-column: 1 / -1;
			justify-self: stretch;
			width: 100%;
			padding: 0.58rem 0.8rem;
			font-size: 0.8rem;
		}

		.search-filters {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-group {
			justify-content: space-between;
		}

		.title-adjust-actions {
			flex-direction: column;
		}

		.search-detail-modal-content {
			width: min(96vw, 760px);
			max-height: min(90vh, 860px);
		}

		.search-detail-grid {
			grid-template-columns: 1fr;
		}

		.search-detail-actions {
			justify-content: stretch;
		}

		.search-detail-primary,
		.search-detail-secondary {
			flex: 1 1 100%;
			text-align: center;
		}
	}
</style>
