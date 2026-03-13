<script lang="ts">
	import PlusIcon from '$lib/assets/icons/PlusIcon.svelte';
	import SidebarShelfEditRow from '../SidebarShelfEditRow/SidebarShelfEditRow.svelte';
	import SidebarShelfRow from '../SidebarShelfRow/SidebarShelfRow.svelte';
	import styles from './SidebarShelvesSection.module.scss';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';

	interface Props {
		shelves: LibraryShelf[];
		selectedShelfId: number | null;
		isLibraryActive?: boolean;
		showCreateShelf?: boolean;
		newShelfName?: string;
		newShelfIcon?: string;
		showCreateEmojiPicker?: boolean;
		editingShelfId: number | null;
		editShelfName?: string;
		editShelfIcon?: string;
		showEditEmojiPicker?: boolean;
		emojiOptions: string[];
		isMutatingShelves?: boolean;
		isReorderingShelves?: boolean;
		draggingShelfId: number | null;
		shelfDragOverId: number | null;
		getShelfRuleCount: (shelf: LibraryShelf) => number;
		onStartCreateShelf: () => void;
		onCreateShelf: () => void;
		onCancelCreateShelf: () => void;
		onToggleCreateEmojiPicker: () => void;
		onSelectCreateEmoji: (emoji: string) => void;
		onRenameShelf: (shelfId: number) => void;
		onCancelRenameShelf: () => void;
		onToggleEditEmojiPicker: () => void;
		onSelectEditEmoji: (emoji: string) => void;
		onShelfPointerDown: (event: PointerEvent, shelfId: number) => void;
		onSelectShelf: (shelfId: number) => void;
		onOpenShelfMenu: (event: MouseEvent, shelfId: number) => void;
		shouldIgnoreShelfClick: () => boolean;
	}

	let {
		shelves,
		selectedShelfId,
		isLibraryActive = false,
		showCreateShelf = false,
		newShelfName = $bindable(''),
		newShelfIcon = $bindable('📚'),
		showCreateEmojiPicker = $bindable(false),
		editingShelfId,
		editShelfName = $bindable(''),
		editShelfIcon = $bindable('📚'),
		showEditEmojiPicker = $bindable(false),
		emojiOptions,
		isMutatingShelves = false,
		isReorderingShelves = false,
		draggingShelfId,
		shelfDragOverId,
		getShelfRuleCount,
		onStartCreateShelf,
		onCreateShelf,
		onCancelCreateShelf,
		onToggleCreateEmojiPicker,
		onSelectCreateEmoji,
		onRenameShelf,
		onCancelRenameShelf,
		onToggleEditEmojiPicker,
		onSelectEditEmoji,
		onShelfPointerDown,
		onSelectShelf,
		onOpenShelfMenu,
		shouldIgnoreShelfClick
	}: Props = $props();
</script>

<div class={styles.root}>
	<div class="shelves-subnav-header">
		<span class="shelves-title">Shelves</span>
		<button type="button" class="shelf-add-btn" onclick={onStartCreateShelf} disabled={isMutatingShelves || isReorderingShelves || draggingShelfId !== null} aria-label="Create shelf">
			<PlusIcon size={16} decorative={true} />
		</button>
	</div>
	<div class="shelves-list">
		{#each shelves as shelf (shelf.id)}
			{#if editingShelfId === shelf.id}
				<div class="shelf-row shelf-row-editing">
					<SidebarShelfEditRow
						bind:name={editShelfName}
						bind:icon={editShelfIcon}
						bind:showEmojiPicker={showEditEmojiPicker}
						emojiOptions={emojiOptions}
						confirmLabel="Save"
						autofocus={true}
						disabled={isMutatingShelves || isReorderingShelves}
						onToggleEmojiPicker={onToggleEditEmojiPicker}
						onSelectEmoji={onSelectEditEmoji}
						onConfirm={() => onRenameShelf(shelf.id)}
						onCancel={onCancelRenameShelf}
					/>
					<span class="shelf-row-btn shelf-row-btn-placeholder" aria-hidden="true"></span>
				</div>
			{:else}
				<SidebarShelfRow
					{shelf}
					active={isLibraryActive && selectedShelfId === shelf.id}
					dragging={draggingShelfId === shelf.id}
					dragOver={draggingShelfId !== null && shelfDragOverId === shelf.id && draggingShelfId !== shelf.id}
					ruleCount={getShelfRuleCount(shelf)}
					menuDisabled={draggingShelfId !== null || isReorderingShelves}
					onPointerDown={(event) => onShelfPointerDown(event, shelf.id)}
					onSelect={() => {
						if (shouldIgnoreShelfClick()) return;
						onSelectShelf(shelf.id);
					}}
					onOpenMenu={(event) => onOpenShelfMenu(event, shelf.id)}
				/>
			{/if}
		{/each}

		{#if showCreateShelf}
			<SidebarShelfEditRow
				bind:name={newShelfName}
				bind:icon={newShelfIcon}
				bind:showEmojiPicker={showCreateEmojiPicker}
				emojiOptions={emojiOptions}
				confirmLabel="Add"
				placeholder="Shelf name"
				autofocus={true}
				disabled={isMutatingShelves || isReorderingShelves}
				onToggleEmojiPicker={onToggleCreateEmojiPicker}
				onSelectEmoji={onSelectCreateEmoji}
				onConfirm={onCreateShelf}
				onCancel={onCancelCreateShelf}
			/>
		{/if}
	</div>
</div>
