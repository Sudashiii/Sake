<script lang="ts">
	import ShelfAssignMenu from '../ShelfAssignMenu/ShelfAssignMenu.svelte';
	import styles from './LibraryListItem.module.scss';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';
	import {
		getFormatBadgeClass,
		getProgressPercent,
		getRoundedRating,
		LIBRARY_SELECTION_LONG_PRESS_MS,
		LIBRARY_SELECTION_PRESS_CANCEL_DISTANCE_PX
	} from '$lib/features/library/libraryView';

	interface Props {
		book: LibraryBook;
		shelves: LibraryShelf[];
		showShelfAssign?: boolean;
		showShelfAssignControl?: boolean;
		selectionMode?: boolean;
		selected?: boolean;
		selectionDisabled?: boolean;
		onOpenDetail: (book: LibraryBook) => void;
		onStartSelectionMode: (book: LibraryBook) => void;
		onToggleSelected: (book: LibraryBook) => void;
		onToggleShelfAssignMenu: () => void;
		onCloseShelfAssignMenu: () => void;
		onToggleBookShelf: (shelfId: number) => void;
	}

	let {
		book,
		shelves,
		showShelfAssign = false,
		showShelfAssignControl = true,
		selectionMode = false,
		selected = false,
		selectionDisabled = false,
		onOpenDetail,
		onStartSelectionMode,
		onToggleSelected,
		onToggleShelfAssignMenu,
		onCloseShelfAssignMenu,
		onToggleBookShelf
	}: Props = $props();

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let pressedPointerId: number | null = null;
	let pressedStartX = 0;
	let pressedStartY = 0;
	let suppressClickUntil = 0;

	function clearPressTimer(): void {
		if (pressTimer !== null) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function resetPressState(): void {
		clearPressTimer();
		pressedPointerId = null;
		pressedStartX = 0;
		pressedStartY = 0;
	}

	function handlePointerDown(event: PointerEvent): void {
		if (selectionMode || selectionDisabled) {
			return;
		}
		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}

		resetPressState();
		pressedPointerId = event.pointerId;
		pressedStartX = event.clientX;
		pressedStartY = event.clientY;
		pressTimer = setTimeout(() => {
			if (pressedPointerId !== event.pointerId) {
				return;
			}

			suppressClickUntil = Date.now() + 500;
			onStartSelectionMode(book);
			resetPressState();
		}, LIBRARY_SELECTION_LONG_PRESS_MS);
	}

	function handlePointerMove(event: PointerEvent): void {
		if (pressedPointerId === null || event.pointerId !== pressedPointerId) {
			return;
		}

		const movedX = Math.abs(event.clientX - pressedStartX);
		const movedY = Math.abs(event.clientY - pressedStartY);
		if (
			movedX > LIBRARY_SELECTION_PRESS_CANCEL_DISTANCE_PX ||
			movedY > LIBRARY_SELECTION_PRESS_CANCEL_DISTANCE_PX
		) {
			resetPressState();
		}
	}

	function handlePointerEnd(event: PointerEvent): void {
		if (pressedPointerId === null || event.pointerId !== pressedPointerId) {
			return;
		}

		resetPressState();
	}

	function handlePrimaryAction(): void {
		if (Date.now() < suppressClickUntil) {
			return;
		}

		if (selectionMode) {
			if (selectionDisabled) {
				return;
			}

			onToggleSelected(book);
			return;
		}

		onOpenDetail(book);
	}
</script>

<div class={styles.root}>
	<button
		type="button"
		class="book-list-item"
		class:selected={selected}
		class:selection-mode={selectionMode}
		aria-label={selectionMode ? `${selected ? 'Deselect' : 'Select'} ${book.title}` : `Show details for ${book.title}`}
		aria-pressed={selectionMode ? selected : undefined}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerEnd}
		onpointercancel={handlePointerEnd}
		onpointerleave={handlePointerEnd}
		onclick={handlePrimaryAction}
	>
		{#if selectionMode}
			<span class:selected class="list-selection-indicator" aria-hidden="true">
				{selected ? '✓' : ''}
			</span>
		{/if}
		<div class="book-list-cover">
			{#if book.cover}
				<img src={book.cover} alt={book.title} loading="lazy" />
			{:else}
				<div class="no-cover"><span class="extension">{book.extension?.toUpperCase() || '?'}</span></div>
			{/if}
		</div>
		<div class="book-list-main">
			<p class="tile-title" title={book.title}>{book.title}</p>
			<p class="tile-author">{book.author || 'Unknown author'}</p>
			{#if book.shelfIds.length > 0}
				<div class="list-shelf-preview">
					{#each book.shelfIds.slice(0, 3) as shelfId}
						{@const shelf = shelves.find((item) => item.id === shelfId)}
						{#if shelf}<span class="list-shelf-chip">{shelf.icon} {shelf.name}</span>{/if}
					{/each}
					{#if book.shelfIds.length > 3}<span class="list-shelf-overflow">+{book.shelfIds.length - 3}</span>{/if}
				</div>
			{/if}
		</div>
		<div class="book-list-meta">
			<div class="tile-rating">
				{#each [1, 2, 3, 4, 5] as star}
					<span class:active={star <= getRoundedRating(book.rating)}>★</span>
				{/each}
			</div>
			{#if book.extension}
				<span class={`list-format ${getFormatBadgeClass(book.extension)}`}>{book.extension.toUpperCase()}</span>
			{/if}
			<span class="list-progress-chip">{getProgressPercent(book).toFixed(1)}%</span>
		</div>
	</button>
	{#if showShelfAssignControl}
		<ShelfAssignMenu bookId={book.id} shelfIds={book.shelfIds} {shelves} open={showShelfAssign} position="list" onToggleOpen={onToggleShelfAssignMenu} onClose={onCloseShelfAssignMenu} onToggleShelf={(shelfId) => onToggleBookShelf(shelfId)} />
	{/if}
</div>
