<script lang="ts">
	import { onMount } from 'svelte';
	import Loading from '$lib/components/Loading/Loading.svelte';
	import SectionErrorBanner from '$lib/components/SectionErrorBanner/SectionErrorBanner.svelte';
	import TrashBookRow from '$lib/features/trash/components/TrashBookRow/TrashBookRow.svelte';
	import TrashDeleteAllWarning from '$lib/features/trash/components/TrashDeleteAllWarning/TrashDeleteAllWarning.svelte';
	import TrashEmptyState from '$lib/features/trash/components/TrashEmptyState/TrashEmptyState.svelte';
	import TrashHeader from '$lib/features/trash/components/TrashHeader/TrashHeader.svelte';
	import { ZUI } from '$lib/client/zui';
	import { toastStore } from '$lib/client/stores/toastStore.svelte';
	import type { ApiError } from '$lib/types/ApiError';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import styles from './page.module.scss';

	let isLoading = $state(true);
	let error = $state<ApiError | null>(null);
	let trashBooks = $state<LibraryBook[]>([]);
	let confirmingDeleteBookId = $state<number | null>(null);
	let isConfirmingEmptyAll = $state(false);
	let restoringBookId = $state<number | null>(null);
	let deletingBookId = $state<number | null>(null);
	let emptyingAll = $state(false);

	onMount(() => {
		void loadTrash();
	});

	async function loadTrash(): Promise<void> {
		isLoading = true;
		error = null;
		const result = await ZUI.getLibraryTrash();
		if (!result.ok) {
			error = result.error;
			isLoading = false;
			return;
		}

		trashBooks = result.value.books.sort((a, b) => String(b.deleted_at ?? '').localeCompare(String(a.deleted_at ?? '')));
		isLoading = false;
	}

	async function handleRestore(book: LibraryBook): Promise<void> {
		if (restoringBookId !== null || deletingBookId !== null || emptyingAll) {
			return;
		}

		restoringBookId = book.id;
		const result = await ZUI.restoreLibraryBook(book.id);
		restoringBookId = null;

		if (!result.ok) {
			toastStore.add(`Failed to restore "${book.title}": ${result.error.message}`, 'error');
			return;
		}

		trashBooks = trashBooks.filter((candidate) => candidate.id !== book.id);
		toastStore.add(`"${book.title}" restored to library`, 'success');
	}

	async function handlePermanentDelete(book: LibraryBook): Promise<void> {
		if (restoringBookId !== null || deletingBookId !== null || emptyingAll) {
			return;
		}

		deletingBookId = book.id;
		const result = await ZUI.deleteTrashedLibraryBook(book.id);
		deletingBookId = null;
		confirmingDeleteBookId = null;

		if (!result.ok) {
			toastStore.add(`Failed to delete "${book.title}": ${result.error.message}`, 'error');
			return;
		}

		trashBooks = trashBooks.filter((candidate) => candidate.id !== book.id);
		toastStore.add(`"${book.title}" permanently deleted`, 'success');
	}

	async function handleEmptyTrash(): Promise<void> {
		if (trashBooks.length === 0 || emptyingAll || restoringBookId !== null || deletingBookId !== null) {
			return;
		}

		emptyingAll = true;
		const targetBooks = [...trashBooks];

		for (const book of targetBooks) {
			const result = await ZUI.deleteTrashedLibraryBook(book.id);
			if (!result.ok) {
				emptyingAll = false;
				toastStore.add(`Stopped while deleting "${book.title}": ${result.error.message}`, 'error');
				await loadTrash();
				return;
			}
		}

		emptyingAll = false;
		isConfirmingEmptyAll = false;
		confirmingDeleteBookId = null;
		trashBooks = [];
		toastStore.add('Trash emptied', 'success');
	}
</script>

<div class={styles.root}>
	<Loading bind:show={isLoading} />

	{#if error}
		<SectionErrorBanner message={error.message} onRetry={() => void loadTrash()} />
	{/if}

	<TrashHeader
		count={trashBooks.length}
		emptyingAll={emptyingAll}
		disabled={emptyingAll || restoringBookId !== null || deletingBookId !== null}
		onEmpty={() => (isConfirmingEmptyAll = true)}
	/>

	{#if isConfirmingEmptyAll}
		<TrashDeleteAllWarning count={trashBooks.length} {emptyingAll} onDeleteAll={() => void handleEmptyTrash()} onCancel={() => (isConfirmingEmptyAll = false)} />
	{/if}

	{#if !isLoading && trashBooks.length === 0}
		<TrashEmptyState />
	{:else}
		<div class={styles.list}>
			{#each trashBooks as book (book.id)}
				<TrashBookRow
					{book}
					{confirmingDeleteBookId}
					{restoringBookId}
					{deletingBookId}
					{emptyingAll}
					onRestore={(book) => void handleRestore(book)}
					onConfirmDelete={(bookId) => (confirmingDeleteBookId = bookId)}
					onDelete={(book) => void handlePermanentDelete(book)}
				/>
			{/each}
		</div>
	{/if}
</div>
