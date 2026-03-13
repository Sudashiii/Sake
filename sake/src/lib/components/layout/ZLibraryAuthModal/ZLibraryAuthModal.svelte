<script lang="ts">
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import BookOpenIcon from '$lib/assets/icons/BookOpenIcon.svelte';
	import type { ApiError } from '$lib/types/ApiError';
	import styles from './ZLibraryAuthModal.module.scss';

	type AuthMode = 'password' | 'remix';

	interface Props {
		username?: string;
		password?: string;
		authMode?: AuthMode;
		isLoading: boolean;
		error: ApiError | null;
		onClose: () => void;
		onSubmit: () => void;
	}

	let {
		username = $bindable(''),
		password = $bindable(''),
		authMode = $bindable<AuthMode>('password'),
		isLoading,
		error,
		onClose,
		onSubmit
	}: Props = $props();

	function handleBackdropKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onClose();
		}
	}

	function handleModalClick(event: MouseEvent): void {
		event.stopPropagation();
	}
</script>

<div class={styles.backdrop} role="button" tabindex="0" onclick={onClose} onkeydown={handleBackdropKeyDown}>
	<div class={styles.modal} role="dialog" aria-modal="true" tabindex="-1" onclick={handleModalClick} onkeydown={(event) => event.stopPropagation()}>
		<div class={styles.header}>
			<div class={styles.icon}>
				<BookOpenIcon size={24} strokeWidth={2} />
			</div>
			<h2>Connect Z-Library</h2>
			<p class={styles.subtitle}>Link your Z-Library account to search and download books</p>
		</div>

		{#if error}
			<div class={styles.error}>
				<AlertCircleIcon size={16} strokeWidth={2} />
				<p>{error.message}</p>
			</div>
		{/if}

		<div class={styles.tabs} aria-label="Z-Library authentication mode">
			<button type="button" class={`${styles.tab} ${authMode === 'password' ? styles.active : ''}`} aria-pressed={authMode === 'password'} onclick={() => (authMode = 'password')}>
				Email Login
			</button>
			<button type="button" class={`${styles.tab} ${authMode === 'remix' ? styles.active : ''}`} aria-pressed={authMode === 'remix'} onclick={() => (authMode = 'remix')}>
				Remix Credentials
			</button>
		</div>

		<div class={styles.formGroup}>
			<label for="zlib-username">{authMode === 'remix' ? 'Remix UserID' : 'Email'}</label>
			<input
				id="zlib-username"
				type="text"
				bind:value={username}
				placeholder={authMode === 'remix' ? 'Enter your Remix UserID' : 'Enter your email'}
			/>
		</div>

		<div class={styles.formGroup}>
			<label for="zlib-password">{authMode === 'remix' ? 'Remix UserKey' : 'Password'}</label>
			<input
				id="zlib-password"
				type="password"
				bind:value={password}
				placeholder={authMode === 'remix' ? 'Enter your Remix UserKey' : 'Enter your password'}
			/>
		</div>

		<div class={styles.actions}>
			<button class={styles.secondaryButton} onclick={onClose}>Cancel</button>
			<button class={styles.primaryButton} onclick={onSubmit} disabled={isLoading}>
				{#if isLoading}
					<span class={styles.spinner}></span>
					Connecting...
				{:else}
					Connect
				{/if}
			</button>
		</div>
	</div>
</div>
