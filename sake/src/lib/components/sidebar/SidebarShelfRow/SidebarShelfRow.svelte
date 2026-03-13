<script lang="ts">
	import FilterFunnelIcon from '$lib/assets/icons/FilterFunnelIcon.svelte';
	import MoreHorizontalIcon from '$lib/assets/icons/MoreHorizontalIcon.svelte';
	import styles from './SidebarShelfRow.module.scss';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';

	interface Props {
		shelf: LibraryShelf;
		active?: boolean;
		dragging?: boolean;
		dragOver?: boolean;
		ruleCount?: number;
		menuDisabled?: boolean;
		onPointerDown: (event: PointerEvent) => void;
		onSelect: () => void;
		onOpenMenu: (event: MouseEvent) => void;
	}

	let {
		shelf,
		active = false,
		dragging = false,
		dragOver = false,
		ruleCount = 0,
		menuDisabled = false,
		onPointerDown,
		onSelect,
		onOpenMenu
	}: Props = $props();
</script>

<div class={`${styles.root} ${dragging ? styles.dragging : ''} ${dragOver ? styles.dragOver : ''}`} data-shelf-id={shelf.id}>
	<button type="button" class={`shelf-link shelf-link-btn ${active ? 'active' : ''} ${dragging ? 'dragging' : ''}`} onpointerdown={onPointerDown} onclick={onSelect}>
		<span class="shelf-icon">{shelf.icon}</span>
		<span class="shelf-name">{shelf.name}</span>
		{#if ruleCount > 0}
			<span class="shelf-rule-indicator" aria-hidden="true">
				<FilterFunnelIcon size={11} strokeWidth={2.2} decorative={true} />
			</span>
		{/if}
	</button>
	<button type="button" class="shelf-row-btn" disabled={menuDisabled} onclick={onOpenMenu} aria-label={`Open menu for ${shelf.name}`}>
		<MoreHorizontalIcon size={15} strokeWidth={2.2} decorative={true} />
	</button>
</div>
