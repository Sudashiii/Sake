<script lang="ts">
	import XIcon from '$lib/assets/icons/XIcon.svelte';
	import type { Snippet } from 'svelte';
	import styles from './BookDetailModalShell.module.scss';

	interface Props {
		title: string;
		showTabs?: boolean;
		onClose: () => void;
		children: Snippet;
		headerActions?: Snippet;
		tabs?: Snippet;
	}

	let { title, showTabs = false, onClose, children, headerActions, tabs }: Props = $props();

	function handleOverlayKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

<div
	class={styles.overlay}
	role="button"
	tabindex="0"
	aria-label="Close book detail modal"
	onclick={onClose}
	onkeydown={handleOverlayKeyDown}
>
	<div
		class={`${styles.content} ${styles.shell}`}
		role="dialog"
		aria-modal="true"
		aria-labelledby="book-detail-title"
		tabindex="-1"
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => event.stopPropagation()}
	>
		<div class={styles.header}>
			<h2 id="book-detail-title">{title}</h2>
			<div class={styles.headerActions}>
				{@render headerActions?.()}
				<button class={styles.closeButton} onclick={onClose} aria-label="Close details">
					<XIcon size={18} strokeWidth={2.1} />
				</button>
			</div>
		</div>

		{#if showTabs}
			<div class={styles.tabs} role="tablist" aria-label="Book detail sections">
				{@render tabs?.()}
			</div>
		{/if}

		<div class={styles.body}>
			{@render children()}
		</div>
	</div>
</div>
