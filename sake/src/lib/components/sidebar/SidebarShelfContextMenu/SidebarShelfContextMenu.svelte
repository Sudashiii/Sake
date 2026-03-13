<script lang="ts">
	import EditIcon from '$lib/assets/icons/EditIcon.svelte';
	import FilterFunnelIcon from '$lib/assets/icons/FilterFunnelIcon.svelte';
	import Trash2Icon from '$lib/assets/icons/Trash2Icon.svelte';
	import styles from './SidebarShelfContextMenu.module.scss';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';

	interface Props {
		shelf: LibraryShelf;
		position: { top: number; left: number };
		ruleCount?: number;
		onClose: () => void;
		onRename: () => void;
		onRules: () => void;
		onDelete: () => void;
	}

	let { shelf, position, ruleCount = 0, onClose, onRename, onRules, onDelete }: Props = $props();
</script>

<button type="button" class={styles.backdrop} aria-label="Close shelf menu" onclick={onClose}></button>
<div class={styles.menu} style={`top: ${position.top}px; left: ${position.left}px;`}>
	<button type="button" class="shelf-context-item" onclick={onRename}>
		<EditIcon size={13} decorative={true} />
		Rename
	</button>
	<button type="button" class="shelf-context-item" onclick={onRules}>
		<FilterFunnelIcon size={13} decorative={true} />
		Rules
		{#if ruleCount > 0}
			<span class="shelf-context-count">{ruleCount}</span>
		{/if}
	</button>
	<div class="shelf-context-separator"></div>
	<button type="button" class="shelf-context-item danger" onclick={onDelete}>
		<Trash2Icon size={13} decorative={true} />
		Delete
	</button>
</div>
