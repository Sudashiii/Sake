<script lang="ts">
	import styles from './ConfirmModal.module.scss';

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		pending?: boolean;
		onConfirm: () => void | Promise<void>;
		onCancel: () => void;
	}

	let {
		open,
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		danger = false,
		pending = false,
		onConfirm,
		onCancel
	}: Props = $props();

	function handleOverlayClick(): void {
		if (!pending) {
			onCancel();
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (pending) {
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			onCancel();
		}
	}
</script>

{#if open}
	<div class={styles.overlay} role="presentation" onclick={handleOverlayClick}>
		<div
			class={styles.card}
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			onclick={(event) => event.stopPropagation()}
			onkeydown={handleKeydown}
		>
			<h3>{title}</h3>
			<p>{message}</p>
			<div class={styles.actions}>
				<button type="button" class={styles.cancelButton} onclick={onCancel} disabled={pending}>
					{cancelLabel}
				</button>
				<button
					type="button"
					class={`${styles.confirmButton} ${danger ? styles.danger : ''}`}
					onclick={() => void onConfirm()}
					disabled={pending}
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
