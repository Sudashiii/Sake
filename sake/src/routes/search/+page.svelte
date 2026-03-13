<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import BookOpenIcon from '$lib/assets/icons/BookOpenIcon.svelte';
	import SearchMinusIcon from '$lib/assets/icons/SearchMinusIcon.svelte';
	import Loading from '$lib/components/Loading/Loading.svelte';
	import SearchBar from '$lib/features/search/components/SearchBar/SearchBar.svelte';
	import SearchFiltersPanel from '$lib/features/search/components/SearchFiltersPanel/SearchFiltersPanel.svelte';
	import ProviderResultsGroup from '$lib/features/search/components/ProviderResultsGroup/ProviderResultsGroup.svelte';
	import TitleAdjustModal from '$lib/features/search/components/TitleAdjustModal/TitleAdjustModal.svelte';
	import SearchBookDetailsModal from '$lib/features/search/components/SearchBookDetailsModal/SearchBookDetailsModal.svelte';
	import {
		emptyCollapsedProviderGroups,
		getActiveProviderOptions,
		getBookCacheKey,
		getDefaultSelectedProviders,
		loadStoredCollapsedProviderGroups,
		loadStoredProviders,
		normalizeProviderSelection,
		normalizeStringSelection,
		parseYearInput,
		persistCollapsedProviderGroups,
		persistSelectedProviders,
		providerLabel,
		SEARCH_FORMAT_OPTIONS,
		SEARCH_LANGUAGE_OPTIONS,
		SEARCH_SORT_OPTIONS,
		toggleProviderGroupState,
		type SearchSortValue
	} from '$lib/features/search/searchView';
	import { ZUI } from '$lib/client/zui';
	import { toastStore } from '$lib/client/stores/toastStore.svelte';
	import type { ApiError } from '$lib/types/ApiError';
	import type { LookupSearchBookMetadataResponse } from '$lib/client/routes/lookupSearchBookMetadata';
	import type { SearchProviderId } from '$lib/types/Search/Provider';
	import type { SearchBooksRequest } from '$lib/types/Search/SearchBooksRequest';
	import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';
	import styles from './page.module.scss';

	let title = $state('');
	let selectedLanguages = $state<string[]>(['english', 'german']);
	let selectedFormats = $state<string[]>(['epub']);
	let selectedProviders = $state<SearchProviderId[]>(
		getDefaultSelectedProviders($page.data.activeSearchProviders)
	);
	let selectedSort = $state<SearchSortValue>('relevance');
	let yearFromInput = $state('');
	let yearToInput = $state('');
	let onlyFilesAvailable = $state(false);
	let collapsedProviderGroups = $state<Record<SearchProviderId, boolean>>(
		emptyCollapsedProviderGroups()
	);
	let books = $state<SearchResultBook[]>([]);
	let isLoading = $state(false);
	let isDownloading = $state(false);
	let downloadingBook = $state<string | null>(null);
	let error = $state<ApiError | null>(null);
	let showTitleAdjustModal = $state(false);
	let pendingBookAction = $state<'download' | 'library' | null>(null);
	let pendingBook = $state<SearchResultBook | null>(null);
	let adjustedTitle = $state('');
	let selectedBookForDetails = $state<SearchResultBook | null>(null);
	let lastFocusedElement = $state<HTMLElement | null>(null);
	let detailMetadataByBookId = $state<Record<string, LookupSearchBookMetadataResponse['metadata']>>({});
	let detailMetadataLoadingByBookId = $state<Record<string, boolean>>({});
	let detailMetadataErrorByBookId = $state<Record<string, string | null>>({});
	const activeSearchProviders = $derived($page.data.activeSearchProviders);
	const providerOptions = $derived(getActiveProviderOptions(activeSearchProviders));

	const displayedBooks = $derived(
		onlyFilesAvailable ? books.filter((book) => book.capabilities.filesAvailable) : books
	);
	const displayedBooksByProvider = $derived.by(() => {
		const grouped: Record<SearchProviderId, SearchResultBook[]> = {
			zlibrary: [],
			openlibrary: [],
			gutenberg: []
		};

		for (const book of displayedBooks) {
			grouped[book.provider].push(book);
		}

		return grouped;
	});

	onMount(() => {
		if (typeof localStorage === 'undefined') {
			return;
		}

		const storedProviders = loadStoredProviders(localStorage, activeSearchProviders);
		if (storedProviders) {
			selectedProviders = storedProviders;
		} else {
			selectedProviders = getDefaultSelectedProviders(activeSearchProviders);
			persistSelectedProviders(localStorage, selectedProviders);
		}

		const storedCollapsed = loadStoredCollapsedProviderGroups(localStorage);
		if (storedCollapsed) {
			collapsedProviderGroups = storedCollapsed;
		}
	});

	$effect(() => {
		const normalizedProviders = normalizeProviderSelection(selectedProviders, activeSearchProviders);
		if (
			normalizedProviders.length !== selectedProviders.length ||
			normalizedProviders.some((providerId, index) => providerId !== selectedProviders[index])
		) {
			selectedProviders = normalizedProviders;
			persistSelectedProviders(
				typeof localStorage === 'undefined' ? undefined : localStorage,
				normalizedProviders
			);
		}
	});

	function handleProviderSelection(nextValues: string[]): void {
		selectedProviders = normalizeProviderSelection(nextValues, activeSearchProviders);
		persistSelectedProviders(typeof localStorage === 'undefined' ? undefined : localStorage, selectedProviders);
	}

	function handleLanguageSelection(nextValues: string[]): void {
		selectedLanguages = normalizeStringSelection(nextValues);
	}

	function handleFormatSelection(nextValues: string[]): void {
		selectedFormats = normalizeStringSelection(nextValues);
	}

	function toggleProviderGroup(providerId: SearchProviderId): void {
		collapsedProviderGroups = toggleProviderGroupState(collapsedProviderGroups, providerId);
		persistCollapsedProviderGroups(
			typeof localStorage === 'undefined' ? undefined : localStorage,
			collapsedProviderGroups
		);
	}

	async function searchBooks(): Promise<void> {
		if (!title.trim() || selectedProviders.length === 0) {
			return;
		}

		isLoading = true;
		error = null;

		const payload: SearchBooksRequest = {
			query: title,
			providers: selectedProviders,
			filters: {
				language: selectedLanguages.length > 0 ? selectedLanguages : undefined,
				extension: selectedFormats.length > 0 ? selectedFormats : undefined,
				yearFrom: parseYearInput(yearFromInput),
				yearTo: parseYearInput(yearToInput),
				limitPerProvider: 20
			},
			sort: selectedSort
		};

		const result = await ZUI.searchBooks(payload);
		if (!result.ok) {
			error = result.error;
			books = [];
			isLoading = false;
			return;
		}

		books = result.value.books;
		const failedProviders = result.value.meta.failedProviders;
		if (failedProviders.length > 0) {
			const failedMessage = failedProviders
				.map((entry) => `${providerLabel(entry.provider)}: ${entry.error}`)
				.join(' | ');
			toastStore.add(`Some providers failed: ${failedMessage}`, 'error');
			if (result.value.books.length === 0) {
				error = { type: 'server', status: 502, message: failedMessage };
			}
		}

		isLoading = false;
	}

	async function handleDownload(book: SearchResultBook): Promise<void> {
		isDownloading = true;
		downloadingBook = book.title;

		const result = await ZUI.downloadSearchBook(book, { downloadToDevice: true });

		isDownloading = false;
		downloadingBook = null;

		if (!result.ok) {
			error = result.error;
			toastStore.add(`Download failed: ${result.error.message}`, 'error');
			return;
		}

		toastStore.add(`Download started for "${book.title}"`, 'success');
	}

	async function handleShare(book: SearchResultBook): Promise<void> {
		const result = await ZUI.queueSearchBookToLibrary(book);
		if (!result.ok) {
			error = result.error;
			toastStore.add(`Failed to add to library: ${result.error.message}`, 'error');
			return;
		}

		if (result.value.mode === 'queued') {
			const queueInfo = result.value.queueStatus.pending > 0
				? ` (${result.value.queueStatus.pending} in queue)`
				: '';
			toastStore.add(`"${book.title}" added to download queue${queueInfo}`, 'success');
			return;
		}

		toastStore.add(`"${book.title}" imported to library`, 'success');
	}

	function openTitleAdjustModal(book: SearchResultBook, action: 'download' | 'library'): void {
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
		adjustedTitle = '';
	}

	async function confirmTitleAdjustAction(): Promise<void> {
		if (!pendingBook || !pendingBookAction) {
			return;
		}

		const finalTitle = adjustedTitle.trim();
		if (!finalTitle) {
			toastStore.add('Title cannot be empty', 'error');
			return;
		}

		const bookWithAdjustedTitle: SearchResultBook = {
			...pendingBook,
			title: finalTitle
		};
		const action = pendingBookAction;
		closeTitleAdjustModal();

		if (action === 'download') {
			await handleDownload(bookWithAdjustedTitle);
			return;
		}

		await handleShare(bookWithAdjustedTitle);
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			void searchBooks();
		}
	}

	async function openSearchBookDetails(book: SearchResultBook): Promise<void> {
		if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
			lastFocusedElement = document.activeElement;
		}

		selectedBookForDetails = book;
		const cacheKey = getBookCacheKey(book.provider, book.providerBookId);
		if (!detailMetadataByBookId[cacheKey] && !detailMetadataLoadingByBookId[cacheKey]) {
			void loadSearchBookMetadata(book);
		}
	}

	function closeSearchBookDetails(): void {
		selectedBookForDetails = null;
		lastFocusedElement?.focus();
		lastFocusedElement = null;
	}

	async function loadSearchBookMetadata(book: SearchResultBook): Promise<void> {
		const cacheKey = getBookCacheKey(book.provider, book.providerBookId);
		detailMetadataLoadingByBookId = {
			...detailMetadataLoadingByBookId,
			[cacheKey]: true
		};
		detailMetadataErrorByBookId = {
			...detailMetadataErrorByBookId,
			[cacheKey]: null
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
				[cacheKey]: result.error.message
			};
			detailMetadataLoadingByBookId = {
				...detailMetadataLoadingByBookId,
				[cacheKey]: false
			};
			return;
		}

		detailMetadataByBookId = {
			...detailMetadataByBookId,
			[cacheKey]: result.value.metadata
		};
		detailMetadataLoadingByBookId = {
			...detailMetadataLoadingByBookId,
			[cacheKey]: false
		};
	}

	async function copyText(value: string, label: string): Promise<void> {
		const text = value.trim();
		if (!text) {
			toastStore.add(`No ${label} to copy`, 'error');
			return;
		}

		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard) {
				await navigator.clipboard.writeText(text);
			} else if (typeof document !== 'undefined') {
				const textarea = document.createElement('textarea');
				textarea.value = text;
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.append(textarea);
				textarea.select();
				const ok = document.execCommand('copy');
				document.body.removeChild(textarea);
				if (!ok) {
					throw new Error('copy command failed');
				}
			} else {
				throw new Error('clipboard unavailable');
			}
			toastStore.add(`${label} copied`, 'success');
		} catch {
			toastStore.add(`Failed to copy ${label}`, 'error');
		}
	}
</script>

<div class={styles.root}>
	<Loading bind:show={isLoading} />

	{#if isDownloading}
		<div class={styles.downloadOverlay}>
			<div class={styles.downloadModal}>
				<div class={styles.downloadSpinner}></div>
				<div class={styles.downloadContent}>
					<h3>Downloading...</h3>
					{#if downloadingBook}
						<p class={styles.downloadTitle}>{downloadingBook}</p>
					{/if}
					<p class={styles.downloadHint}>Please wait while we fetch your book</p>
				</div>
			</div>
		</div>
	{/if}

	<header class={styles.pageHeader}>
		<div>
			<h1>Search Books</h1>
			<p>Find books across multiple providers</p>
		</div>
	</header>

	<div class={styles.searchContainer}>
		<SearchBar
			bind:title
			disabled={!title.trim() || selectedProviders.length === 0}
			onSearch={() => void searchBooks()}
			onKeydown={handleKeyDown}
		/>
		<SearchFiltersPanel
			{providerOptions}
			languageOptions={SEARCH_LANGUAGE_OPTIONS}
			formatOptions={SEARCH_FORMAT_OPTIONS}
			sortOptions={SEARCH_SORT_OPTIONS}
			selectedProviders={selectedProviders}
			bind:selectedLanguages
			bind:selectedFormats
			bind:selectedSort
			bind:yearFromInput
			bind:yearToInput
			bind:onlyFilesAvailable
			onProviderSelection={handleProviderSelection}
			onLanguageSelection={handleLanguageSelection}
			onFormatSelection={handleFormatSelection}
		/>
	</div>

	{#if error}
		<div class={styles.error}>
			<AlertCircleIcon size={18} decorative={true} />
			<p>{error.message}</p>
		</div>
	{/if}

	<div class={styles.results}>
		{#if displayedBooks.length > 0}
			<div class={styles.resultsHeader}>
				<span class={styles.resultsCount}>{displayedBooks.length} result{displayedBooks.length !== 1 ? 's' : ''} found</span>
			</div>
			{#each selectedProviders as providerId}
				{@const providerBooks = displayedBooksByProvider[providerId]}
				{#if providerBooks.length > 0}
					<ProviderResultsGroup
						{providerId}
						books={providerBooks}
						collapsed={collapsedProviderGroups[providerId] ?? false}
						onToggle={toggleProviderGroup}
						onDownload={(book) => openTitleAdjustModal(book, 'download')}
						onShare={(book) => openTitleAdjustModal(book, 'library')}
						onOpenDetails={openSearchBookDetails}
					/>
				{/if}
			{/each}
		{:else if !isLoading && title}
			<div class={styles.emptyState}>
				<SearchMinusIcon size={48} decorative={true} strokeWidth={1.5} />
				<h3>No books found</h3>
				<p>Try adjusting your search terms or filters</p>
			</div>
		{:else if !isLoading}
			<div class={styles.emptyState}>
				<BookOpenIcon size={48} decorative={true} strokeWidth={1.5} />
				<h3>Search for books</h3>
				<p>Enter a title, author, or ISBN to get started</p>
			</div>
		{/if}
	</div>
</div>

<TitleAdjustModal
	open={showTitleAdjustModal && pendingBook !== null}
	bind:title={adjustedTitle}
	actionLabel={pendingBookAction === 'download' ? 'Download' : 'Add To Library'}
	onClose={closeTitleAdjustModal}
	onConfirm={() => void confirmTitleAdjustAction()}
/>

{#if selectedBookForDetails}
	{@const detailBook = selectedBookForDetails}
	{@const detailBookKey = getBookCacheKey(detailBook.provider, detailBook.providerBookId)}
	<SearchBookDetailsModal
		book={detailBook}
		metadata={detailMetadataByBookId[detailBookKey]}
		isLoading={detailMetadataLoadingByBookId[detailBookKey] ?? false}
		error={detailMetadataErrorByBookId[detailBookKey]}
		onClose={closeSearchBookDetails}
		onRetry={() => void loadSearchBookMetadata(detailBook)}
		onCopy={copyText}
		onDownload={(book) => openTitleAdjustModal(book, 'download')}
		onAddToLibrary={(book) => openTitleAdjustModal(book, 'library')}
	/>
{/if}
