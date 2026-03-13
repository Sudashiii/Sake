<script lang="ts">
	import FilterFunnelIcon from '$lib/assets/icons/FilterFunnelIcon.svelte';
	import XIcon from '$lib/assets/icons/XIcon.svelte';
	import styles from './ShelfRulesHeader.module.scss';

	interface Props {
		shelfName: string;
		shelfIcon: string;
		pending?: boolean;
		onClose: () => void;
	}

	let { shelfName, shelfIcon, pending = false, onClose }: Props = $props();
</script>

<header class={styles.root}>
	<div class={styles.titleWrap}>
		<div class={styles.icon} aria-hidden="true">
			<FilterFunnelIcon size={16} strokeWidth={2.1} />
		</div>
		<div>
			<h2 id="shelf-rules-title">Shelf Rules</h2>
			<p>{shelfIcon} {shelfName}</p>
		</div>
	</div>
	<button type="button" class={styles.closeButton} onclick={onClose} disabled={pending} aria-label="Close rules modal">
		<XIcon size={16} strokeWidth={2.1} />
	</button>
</header>
