<script lang="ts">
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
		confirmLabel = "Confirm",
		cancelLabel = "Cancel",
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
		if (event.key === "Escape") {
			event.preventDefault();
			onCancel();
		}
	}
</script>

{#if open}
	<div class="confirm-modal-overlay" role="presentation" onclick={handleOverlayClick}>
		<div
			class="confirm-modal-card"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			onclick={(event) => event.stopPropagation()}
			onkeydown={handleKeydown}
		>
			<h3>{title}</h3>
			<p>{message}</p>
			<div class="confirm-modal-actions">
				<button type="button" class="confirm-modal-cancel" onclick={onCancel} disabled={pending}>
					{cancelLabel}
				</button>
				<button
					type="button"
					class="confirm-modal-confirm"
					class:danger={danger}
					onclick={() => void onConfirm()}
					disabled={pending}
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.confirm-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		padding: 1rem;
		z-index: 1600;
	}

	.confirm-modal-card {
		width: min(26rem, 100%);
		border-radius: 0.9rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 1rem;
		display: grid;
		gap: 0.6rem;
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.4);
	}

	.confirm-modal-card h3 {
		margin: 0;
		font-size: 1rem;
		color: var(--color-text-primary);
	}

	.confirm-modal-card p {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.45;
		color: var(--color-text-secondary);
	}

	.confirm-modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.45rem;
	}

	.confirm-modal-actions button {
		padding: 0.42rem 0.65rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		background: #232834;
		color: var(--color-text-secondary);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
	}

	.confirm-modal-actions button:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.confirm-modal-confirm {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		border-color: color-mix(in oklab, var(--color-primary), transparent 60%);
	}

	.confirm-modal-confirm.danger {
		background: rgba(196, 68, 58, 0.18);
		border-color: rgba(196, 68, 58, 0.38);
		color: #ffb4ad;
	}
</style>
