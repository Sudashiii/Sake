<script lang="ts">
	import styles from './TitleAdjustModal.module.scss';

	interface Props {
		open?: boolean;
		title?: string;
		actionLabel: string;
		onClose: () => void;
		onConfirm: () => void;
	}

	let {
		open = false,
		title = $bindable(''),
		actionLabel,
		onClose,
		onConfirm
	}: Props = $props();
</script>

{#if open}
	<div class={styles.root} role="button" tabindex="0" aria-label="Close title adjustment modal" onclick={onClose} onkeydown={(event) => event.key === 'Escape' && onClose()}>
		<div class="title-adjust-modal-content" role="dialog" aria-modal="true" aria-labelledby="title-adjust-heading" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={(event) => event.stopPropagation()}>
			<h3 id="title-adjust-heading">Adjust Book Title</h3>
			<p class="title-adjust-description">This title will be used for the filename and reader metadata.</p>
			<label class="title-adjust-label" for="adjusted-book-title">Title</label>
			<input id="adjusted-book-title" type="text" bind:value={title} placeholder="Book title" />
			<div class="title-adjust-actions">
				<button type="button" class="title-adjust-cancel" onclick={onClose}>Cancel</button>
				<button type="button" class="title-adjust-confirm" onclick={onConfirm}>{actionLabel}</button>
			</div>
		</div>
	</div>
{/if}
