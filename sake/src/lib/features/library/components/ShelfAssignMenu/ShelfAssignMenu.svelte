<script lang="ts">
	import BookmarkPlusIcon from '$lib/assets/icons/BookmarkPlusIcon.svelte';
	import styles from './ShelfAssignMenu.module.scss';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';

	interface Props {
		bookId: number;
		shelfIds: number[];
		shelves: LibraryShelf[];
		open?: boolean;
		position?: 'grid' | 'list';
		onToggleOpen: () => void;
		onClose: () => void;
		onToggleShelf: (shelfId: number) => void;
	}

	let {
		bookId,
		shelfIds,
		shelves,
		open = false,
		position = 'grid',
		onToggleOpen,
		onClose,
		onToggleShelf
	}: Props = $props();
</script>

<div class={`${styles.root} ${position === 'grid' ? styles.grid : styles.list}`}>
	<div class="shelf-assign-wrap">
		<button
			type="button"
			class={`shelf-assign-btn ${position === 'list' ? 'shelf-assign-btn-list' : ''}`}
			title="Add to shelf"
			aria-expanded={open}
			onclick={(event) => {
				event.stopPropagation();
				onToggleOpen();
			}}
		>
			<BookmarkPlusIcon size={13} decorative={true} />
		</button>
		{#if open}
			<button type="button" class="menu-backdrop" aria-label="Close shelf menu" onclick={(event) => { event.stopPropagation(); onClose(); }}></button>
			<div class={`shelf-assign-menu ${position === 'grid' ? 'shelf-assign-menu-grid' : 'shelf-assign-menu-list'}`}>
				<div class="shelf-assign-menu-head">Add to Shelf</div>
				{#if shelves.length === 0}
					<div class="shelf-assign-empty">No shelves yet</div>
				{:else}
					{#each shelves as shelf (shelf.id)}
						{@const isOnShelf = shelfIds.includes(shelf.id)}
						<button type="button" class={`shelf-assign-item ${isOnShelf ? 'on-shelf' : ''}`} onclick={(event) => { event.stopPropagation(); onToggleShelf(shelf.id); }}>
							<span>{shelf.icon}</span>
							<span class="shelf-assign-item-name">{shelf.name}</span>
							{#if isOnShelf}
								<span class="shelf-assign-check">✓</span>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>
