<script lang="ts">
	import ArchiveBoxIcon from '$lib/assets/icons/ArchiveBoxIcon.svelte';
	import BookmarkPlusIcon from '$lib/assets/icons/BookmarkPlusIcon.svelte';
	import CheckCircleIcon from '$lib/assets/icons/CheckCircleIcon.svelte';
	import DownloadIcon from '$lib/assets/icons/DownloadIcon.svelte';
	import Trash2Icon from '$lib/assets/icons/Trash2Icon.svelte';
	import XIcon from '$lib/assets/icons/XIcon.svelte';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';
	import styles from './LibraryBulkActionsBar.module.scss';

	interface Props {
		selectedCount: number;
		visibleCount: number;
		shelves: LibraryShelf[];
		isPending?: boolean;
		onDisableSelectionMode: () => void;
		onSelectAllVisible: () => void;
		onClearSelection: () => void;
		onArchiveSelected: () => void;
		onMarkReadSelected: () => void;
		onMarkUnreadSelected: () => void;
		onMoveToTrashSelected: () => void;
		onResetDownloadsSelected: () => void;
		onAddSelectionToShelf: (shelfId: number) => void;
		onRemoveSelectionFromShelf: (shelfId: number) => void;
	}

	let {
		selectedCount,
		visibleCount,
		shelves,
		isPending = false,
		onDisableSelectionMode,
		onSelectAllVisible,
		onClearSelection,
		onArchiveSelected,
		onMarkReadSelected,
		onMarkUnreadSelected,
		onMoveToTrashSelected,
		onResetDownloadsSelected,
		onAddSelectionToShelf,
		onRemoveSelectionFromShelf
	}: Props = $props();

	let activeShelfMenu = $state<'add' | 'remove' | null>(null);

	const hasSelection = $derived(selectedCount > 0);
	const hasVisibleBooks = $derived(visibleCount > 0);

	$effect(() => {
		if (isPending || !hasSelection) {
			activeShelfMenu = null;
		}
	});

	function toggleShelfMenu(mode: 'add' | 'remove'): void {
		if (!hasSelection || isPending) {
			return;
		}

		activeShelfMenu = activeShelfMenu === mode ? null : mode;
	}

	function handleShelfAction(shelfId: number): void {
		if (activeShelfMenu === 'add') {
			onAddSelectionToShelf(shelfId);
		} else if (activeShelfMenu === 'remove') {
			onRemoveSelectionFromShelf(shelfId);
		}

		activeShelfMenu = null;
	}
</script>

<section class={styles.root}>
	<div class="selection-head">
		<div class="selection-summary">
			<strong>{selectedCount}</strong>
			<span>selected</span>
			<em>{visibleCount} visible</em>
		</div>

		<div class="selection-controls">
			<button type="button" class="secondary-btn" onclick={onSelectAllVisible} disabled={!hasVisibleBooks || isPending}>
				Select Visible
			</button>
			<button type="button" class="secondary-btn" onclick={onClearSelection} disabled={!hasSelection || isPending}>
				Clear
			</button>
			<button type="button" class="secondary-btn" onclick={onDisableSelectionMode} disabled={isPending}>
				<XIcon size={14} decorative={true} />
				<span>Done</span>
			</button>
		</div>
	</div>

	<div class="bulk-actions">
		<button type="button" class="action-btn" onclick={onArchiveSelected} disabled={!hasSelection || isPending}>
			<ArchiveBoxIcon size={15} decorative={true} />
			<span>Archive</span>
		</button>
		<button type="button" class="action-btn" onclick={onMarkReadSelected} disabled={!hasSelection || isPending}>
			<CheckCircleIcon size={15} decorative={true} />
			<span>Mark Read</span>
		</button>
		<button type="button" class="action-btn" onclick={onMarkUnreadSelected} disabled={!hasSelection || isPending}>
			<XIcon size={15} decorative={true} />
			<span>Mark Unread</span>
		</button>

		<div class="menu-wrap">
			<button type="button" class="action-btn" onclick={() => toggleShelfMenu('add')} disabled={!hasSelection || isPending}>
				<BookmarkPlusIcon size={15} decorative={true} />
				<span>Add Shelf</span>
			</button>
			{#if activeShelfMenu === 'add'}
				<button type="button" class="menu-backdrop" aria-label="Close add-shelf menu" onclick={() => (activeShelfMenu = null)}></button>
				<div class="menu-popover">
					<div class="menu-title">Add selected books to shelf</div>
					{#if shelves.length === 0}
						<p class="menu-empty">No shelves yet</p>
					{:else}
						{#each shelves as shelf (shelf.id)}
							<button type="button" class="menu-item" onclick={() => handleShelfAction(shelf.id)}>
								<span>{shelf.icon}</span>
								<span>{shelf.name}</span>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<div class="menu-wrap">
			<button type="button" class="action-btn" onclick={() => toggleShelfMenu('remove')} disabled={!hasSelection || isPending}>
				<BookmarkPlusIcon size={15} decorative={true} />
				<span>Remove Shelf</span>
			</button>
			{#if activeShelfMenu === 'remove'}
				<button type="button" class="menu-backdrop" aria-label="Close remove-shelf menu" onclick={() => (activeShelfMenu = null)}></button>
				<div class="menu-popover">
					<div class="menu-title">Remove selected books from shelf</div>
					{#if shelves.length === 0}
						<p class="menu-empty">No shelves yet</p>
					{:else}
						{#each shelves as shelf (shelf.id)}
							<button type="button" class="menu-item" onclick={() => handleShelfAction(shelf.id)}>
								<span>{shelf.icon}</span>
								<span>{shelf.name}</span>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<button type="button" class="action-btn" onclick={onResetDownloadsSelected} disabled={!hasSelection || isPending}>
			<DownloadIcon />
			<span>Reset Download</span>
		</button>
		<button type="button" class="action-btn danger-btn" onclick={onMoveToTrashSelected} disabled={!hasSelection || isPending}>
			<Trash2Icon size={15} decorative={true} />
			<span>Move To Trash</span>
		</button>
	</div>
</section>
