<script lang="ts">
	import ShelfAssignMenu from '../ShelfAssignMenu/ShelfAssignMenu.svelte';
	import styles from './LibraryGridItem.module.scss';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';
	import { getFormatBadgeClass, getProgressPercent, getRoundedRating } from '$lib/features/library/libraryView';

	interface Props {
		book: LibraryBook;
		shelves: LibraryShelf[];
		showShelfAssign?: boolean;
		showShelfAssignControl?: boolean;
		onOpenDetail: (book: LibraryBook) => void;
		onToggleShelfAssignMenu: () => void;
		onCloseShelfAssignMenu: () => void;
		onToggleBookShelf: (shelfId: number) => void;
	}

	let {
		book,
		shelves,
		showShelfAssign = false,
		showShelfAssignControl = true,
		onOpenDetail,
		onToggleShelfAssignMenu,
		onCloseShelfAssignMenu,
		onToggleBookShelf
	}: Props = $props();
</script>

<div class={styles.root}>
	<button type="button" class="book-tile" aria-label={`Show details for ${book.title}`} onclick={() => onOpenDetail(book)}>
		<div class="book-tile-cover">
			{#if book.cover}
				<img src={book.cover} alt={book.title} loading="lazy" />
			{:else}
				<div class="no-cover"><span class="extension">{book.extension?.toUpperCase() || '?'}</span></div>
			{/if}
			{#if book.extension}
				<span class={`tile-format ${getFormatBadgeClass(book.extension)}`}>{book.extension.toUpperCase()}</span>
			{/if}
			{#if getProgressPercent(book) > 0 && getProgressPercent(book) < 100}
				<div class="tile-progress-track"><div class="tile-progress-fill" style={`width: ${getProgressPercent(book)}%`}></div></div>
			{/if}
		</div>
		<div class="book-tile-meta">
			<p class="tile-title" title={book.title}>{book.title}</p>
			<p class="tile-author">{book.author || 'Unknown author'}</p>
			<div class="tile-meta-bottom">
				<div class="tile-rating">
					{#each [1, 2, 3, 4, 5] as star}
						<span class:active={star <= getRoundedRating(book.rating)}>★</span>
					{/each}
				</div>
				{#if book.shelfIds.length > 0}
					<div class="tile-shelf-preview">
						{#each book.shelfIds.slice(0, 2) as shelfId}
							{@const shelf = shelves.find((item) => item.id === shelfId)}
							{#if shelf}<span title={shelf.name}>{shelf.icon}</span>{/if}
						{/each}
						{#if book.shelfIds.length > 2}
							<span class="tile-shelf-overflow">+{book.shelfIds.length - 2}</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</button>
	{#if showShelfAssignControl}
		<ShelfAssignMenu bookId={book.id} shelfIds={book.shelfIds} {shelves} open={showShelfAssign} position="grid" onToggleOpen={onToggleShelfAssignMenu} onClose={onCloseShelfAssignMenu} onToggleShelf={(shelfId) => onToggleBookShelf(shelfId)} />
	{/if}
</div>
