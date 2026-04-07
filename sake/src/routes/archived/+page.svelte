<script lang="ts">
	import { onMount } from 'svelte';
	import Loading from '$lib/components/Loading/Loading.svelte';
	import SectionErrorBanner from '$lib/components/SectionErrorBanner/SectionErrorBanner.svelte';
	import ArchivedBookCard from '$lib/features/archived/components/ArchivedBookCard/ArchivedBookCard.svelte';
	import ArchivedDetailModal from '$lib/features/archived/components/ArchivedDetailModal/ArchivedDetailModal.svelte';
	import ArchivedEmptyState from '$lib/features/archived/components/ArchivedEmptyState/ArchivedEmptyState.svelte';
	import ArchivedHeader from '$lib/features/archived/components/ArchivedHeader/ArchivedHeader.svelte';
	import { ZUI } from '$lib/client/zui';
	import { findBookByOpenBookId, loadLibraryBookDetail } from '$lib/features/library/libraryDetailLoader';
	import { unarchiveLibraryBookAction } from '$lib/features/library/libraryRouteActions';
	import {
		parseOpenBookIdFromSearch,
		replaceCurrentOpenBookId
	} from '$lib/features/library/libraryRouteUrlState';
	import type { ApiError } from '$lib/types/ApiError';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
	import styles from './page.module.scss';

	let isLoading = $state(true);
	let error = $state<ApiError | null>(null);
	let archivedBooks = $state<LibraryBook[]>([]);
	let unarchivingBookId = $state<number | null>(null);
	let selectedBook = $state<LibraryBook | null>(null);
	let selectedBookDetail = $state<LibraryBookDetail | null>(null);
	let showDetailModal = $state(false);
	let isDetailLoading = $state(false);
	let detailError = $state<string | null>(null);

	onMount(() => {
		(async () => {
			await loadArchived();
			const candidate = findBookByOpenBookId(
				archivedBooks,
				parseOpenBookIdFromSearch(window.location.search)
			);
			if (candidate) {
				await openDetailModal(candidate);
			}
		})();
	});

	async function loadArchived(): Promise<void> {
		isLoading = true;
		error = null;
		const result = await ZUI.getLibrary();
		if (!result.ok) {
			error = result.error;
			isLoading = false;
			return;
		}

		archivedBooks = result.value.books
			.filter((book) => Boolean(book.archived_at))
			.sort((a, b) => String(b.archived_at ?? '').localeCompare(String(a.archived_at ?? '')));
		isLoading = false;
	}

	async function handleUnarchive(book: LibraryBook): Promise<void> {
		if (unarchivingBookId !== null) {
			return;
		}

		unarchivingBookId = book.id;
		const result = await unarchiveLibraryBookAction(book);
		unarchivingBookId = null;

		if (!result.ok) {
			return;
		}

		archivedBooks = archivedBooks.filter((candidate) => candidate.id !== book.id);
		if (selectedBook?.id === book.id) {
			closeDetailModal();
		}
	}

	async function openDetailModal(book: LibraryBook): Promise<void> {
		selectedBook = book;
		selectedBookDetail = null;
		detailError = null;
		showDetailModal = true;
		isDetailLoading = true;
		replaceCurrentOpenBookId(book.id);

		const result = await loadLibraryBookDetail(book.id);
		isDetailLoading = false;

		if (!result.ok) {
			detailError = result.error.message;
			return;
		}

		selectedBookDetail = result.value;
	}

	function closeDetailModal(): void {
		showDetailModal = false;
		selectedBook = null;
		selectedBookDetail = null;
		detailError = null;
		isDetailLoading = false;
		replaceCurrentOpenBookId(null);
	}
</script>

<div class={styles.root}>
	<Loading bind:show={isLoading} />

	{#if error}
		<SectionErrorBanner message={error.message} onRetry={() => void loadArchived()} />
	{/if}

	<ArchivedHeader count={archivedBooks.length} />

	{#if !isLoading && archivedBooks.length === 0}
		<ArchivedEmptyState />
	{:else}
		<div class={styles.list}>
			{#each archivedBooks as book (book.id)}
				<ArchivedBookCard {book} {unarchivingBookId} onOpenDetail={openDetailModal} onUnarchive={(book) => void handleUnarchive(book)} />
			{/each}
		</div>
	{/if}
</div>

{#if showDetailModal && selectedBook}
	<ArchivedDetailModal
		{selectedBook}
		{selectedBookDetail}
		{isDetailLoading}
		detailError={detailError}
		{unarchivingBookId}
		onClose={closeDetailModal}
		onUnarchive={(book) => void handleUnarchive(book)}
	/>
{/if}
