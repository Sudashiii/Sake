<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import SakeLogo from '$lib/assets/svg/SakeLogo.svelte';
	import { AuthService } from '$lib/client/services/authService';
	import type { ApiError } from '$lib/types/ApiError';

	type AuthMode = 'login' | 'bootstrap';

	let username = $state('');
	let password = $state('');
	let authMode = $state<AuthMode>('login');
	let isInitializing = $state(true);
	let isSubmitting = $state(false);
	let error = $state<ApiError | null>(null);

	const heading = $derived(authMode === 'bootstrap' ? 'Create the first account' : 'Welcome back');
	const subtitle = $derived(
		authMode === 'bootstrap'
			? 'Set up the local Sake account used for this instance.'
			: 'Sign in to your private digital library.'
	);
	const submitLabel = $derived(authMode === 'bootstrap' ? 'Create Account' : 'Sign In');
	const helperText = $derived(
		authMode === 'bootstrap'
			? 'This instance has no local account yet.'
			: 'Use the local Sake account credentials for this server.'
	);

	function getAuthenticatedRoute(): string {
		return $page.data.searchEnabled ? '/search' : '/library';
	}

	async function initializePage(): Promise<void> {
		error = null;
		isInitializing = true;

		const sessionResult = await AuthService.restoreSession();
		if (sessionResult.ok) {
			await goto(getAuthenticatedRoute());
			return;
		}

		const statusResult = await AuthService.getStatus();
		if (!statusResult.ok) {
			error = statusResult.error;
			authMode = 'login';
			isInitializing = false;
			return;
		}

		authMode = statusResult.value.needsBootstrap ? 'bootstrap' : 'login';
		isInitializing = false;
	}

	async function handleSubmit(): Promise<void> {
		if (!username || !password || isSubmitting || isInitializing) {
			return;
		}

		isSubmitting = true;
		error = null;

		const result =
			authMode === 'bootstrap'
				? await AuthService.bootstrap({
						username,
						password
					})
				: await AuthService.login({ username, password });

		if (!result.ok) {
			error = result.error;
			isSubmitting = false;
			return;
		}

		await goto(getAuthenticatedRoute());
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			void handleSubmit();
		}
	}

	onMount(() => {
		void initializePage();
	});
</script>

<main class="login-shell">
	<div class="glow glow-left"></div>
	<div class="glow glow-right"></div>

	{#if !isInitializing}
		<section class="login-wrap">
			<div class="login-panel">
				<div class="brand-row">
					<div class="logo">
						<SakeLogo size={28} decorative={true} />
					</div>
					<div class="brand-copy">
						<h1>{heading}</h1>
						<p>{subtitle}</p>
					</div>
				</div>

				{#if error}
					<div class="error-box">
						<AlertCircleIcon size={16} />
						<p>{error.message}</p>
					</div>
				{/if}

				<p class="signup-note">{helperText}</p>

				<div class="field-group">
					<label for="username">Username</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						placeholder={authMode === 'bootstrap' ? 'Choose a username' : 'Enter username'}
						onkeydown={handleKeyDown}
						autocomplete="username"
					/>
				</div>

				<div class="field-group">
					<label for="password">Password</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder={authMode === 'bootstrap' ? 'Create a password' : 'Enter password'}
						onkeydown={handleKeyDown}
						autocomplete={authMode === 'bootstrap' ? 'new-password' : 'current-password'}
					/>
				</div>

				<button class="login-btn" onclick={() => void handleSubmit()} disabled={isSubmitting}>
					{#if isSubmitting}
						<span class="spinner"></span>
						{authMode === 'bootstrap' ? 'Creating account...' : 'Signing in...'}
					{:else}
						{submitLabel}
					{/if}
				</button>
			</div>

			<div class="visual-panel" aria-hidden="true">
				<div class="visual-overlay"></div>
				<div class="visual-content">
					<h2>Sake</h2>
					<p>Search, queue, sync progress, and curate your personal reading library with a focused workflow.</p>
				</div>
			</div>
		</section>
	{:else}
		<div class="redirect-panel">
			<div class="spinner"></div>
			<p>Checking session...</p>
		</div>
	{/if}
</main>

<style>
	.login-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: var(--color-background);
	}

	.glow {
		display: none;
	}

	.login-wrap {
		display: grid;
		grid-template-columns: minmax(320px, 440px) minmax(280px, 480px);
		width: min(980px, 100%);
		min-height: 560px;
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		overflow: hidden;
		background: var(--color-surface);
	}

	.login-panel {
		padding: 2.15rem;
		display: grid;
		align-content: center;
		gap: 0.95rem;
		background: var(--color-background);
	}

	.brand-row {
		display: flex;
		align-items: center;
		gap: 0.78rem;
		margin-bottom: 0.4rem;
	}

	.logo {
		width: 2.5rem;
		height: 2.5rem;
		display: grid;
		place-items: center;
		border-radius: 0.72rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.045em;
		background: rgba(201, 169, 98, 0.14);
		color: var(--color-primary);
		border: 1px solid rgba(201, 169, 98, 0.28);
	}

	.brand-copy h1 {
		margin: 0;
		font-size: 1.56rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.brand-copy p {
		margin: 0.22rem 0 0;
		font-size: 0.87rem;
		color: var(--color-text-muted);
	}

	.field-group {
		display: grid;
		gap: 0.36rem;
	}

	.field-group label {
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.field-group input {
		width: 100%;
		padding: 0.72rem 0.82rem;
		border-radius: 0.62rem;
		border: 1px solid var(--color-border);
		background: #1a1d27;
		color: var(--color-text-primary);
		font-size: 0.9rem;
		font-family: inherit;
	}

	.field-group input:focus {
		outline: none;
		border-color: rgba(201, 169, 98, 0.6);
		box-shadow: 0 0 0 2px rgba(201, 169, 98, 0.18);
	}

	.field-group input::placeholder {
		color: rgba(122, 120, 114, 0.9);
	}

	.login-btn {
		margin-top: 0.35rem;
		width: 100%;
		padding: 0.74rem 0.84rem;
		border-radius: 0.62rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		font-size: 0.86rem;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		cursor: pointer;
	}

	.login-btn:hover:not(:disabled) {
		filter: brightness(1.05);
	}

	.login-btn:disabled {
		opacity: 0.62;
		cursor: not-allowed;
	}

	.visual-panel {
		position: relative;
		display: flex;
		align-items: end;
		padding: 1.9rem;
		background: #161921;
		overflow: hidden;
	}

	.visual-panel::before {
		content: "";
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 18% 22%, rgba(201, 169, 98, 0.22), transparent 0 28%),
			radial-gradient(circle at 76% 28%, rgba(120, 91, 255, 0.14), transparent 0 24%),
			radial-gradient(circle at 52% 78%, rgba(76, 131, 255, 0.14), transparent 0 26%),
			linear-gradient(145deg, rgba(34, 38, 51, 0.96), rgba(18, 20, 28, 0.88));
		opacity: 1;
	}

	.visual-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(160deg, rgba(13, 15, 20, 0.1), rgba(13, 15, 20, 0.72));
	}

	.visual-content {
		position: relative;
		z-index: 1;
		max-width: 34ch;
	}

	.visual-content h2 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.visual-content p {
		margin: 0.46rem 0 0;
		font-size: 0.85rem;
		line-height: 1.55;
		color: var(--color-text-secondary);
	}

	.error-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.56rem 0.64rem;
		border-radius: 0.56rem;
		border: 1px solid rgba(196, 68, 58, 0.45);
		background: rgba(196, 68, 58, 0.16);
		font-size: 0.78rem;
		color: #ffb4ad;
	}

	.error-box p {
		margin: 0;
	}

	.signup-note {
		margin: 0.2rem 0 0;
		font-size: 0.74rem;
		color: var(--color-text-muted);
	}

	.redirect-panel {
		display: grid;
		justify-items: center;
		gap: 0.7rem;
		padding: 2rem;
		border-radius: 0.9rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.redirect-panel p {
		margin: 0;
		font-size: 0.86rem;
		color: var(--color-text-secondary);
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 900px) {
		.login-wrap {
			grid-template-columns: minmax(0, 1fr);
			min-height: auto;
		}

		.visual-panel {
			display: none;
		}

		.login-panel {
			padding: 1.3rem;
		}
	}
</style>
