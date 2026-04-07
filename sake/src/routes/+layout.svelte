<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { ZLIBRARY_AUTH_CLEARED_EVENT_NAME } from '$lib/auth/responseSignals';
	import { toastStore } from '$lib/client/stores/toastStore.svelte';
	import { shelfStore } from '$lib/client/stores/shelfStore.svelte';
	import { ZLibAuthService } from '$lib/client/services/zlibAuthService';
	import Sidebar from '$lib/components/sidebar/Sidebar/Sidebar.svelte';
	import AppTopBar from '$lib/components/layout/AppTopBar/AppTopBar.svelte';
	import MobileSidebarBackdrop from '$lib/components/layout/MobileSidebarBackdrop/MobileSidebarBackdrop.svelte';
	import ToastContainer from '$lib/components/ToastContainer/ToastContainer.svelte';
	import ZLibraryAuthModal from '$lib/components/layout/ZLibraryAuthModal/ZLibraryAuthModal.svelte';
	import type { ApiError } from '$lib/types/ApiError';
	import type { AppVersionResponse } from '$lib/types/App/AppVersion';
	import {
		getDatabaseMigrationStatusNote,
		shouldShowDatabaseMigrationWarning
	} from '$lib/utils/databaseMigrationStatus';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		data: {
			appVersionInfo: AppVersionResponse | null;
			appVersionError: string | null;
		};
	}

	const { children, data }: Props = $props();

	const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

	let showModal = $state(false);
	let username = $state('');
	let password = $state('');
	let zlibName = $state('');
	let authMode = $state<'password' | 'remix'>('password');
	let isLoading = $state(false);
	let isLoggingOutZLibrary = $state(false);
	let error = $state<ApiError | null>(null);
	let sidebarCollapsed = $state(false);
	let sidebarMobileOpen = $state(false);
	// Check if we're on the login page (don't show sidebar there)
	let isLoginPage = $derived($page.url.pathname === '/');
	let databaseMigrationWarning = $derived(
		getDatabaseMigrationStatusNote(data.appVersionInfo?.database ?? null, data.appVersionError)
	);
	let showDatabaseMigrationWarning = $derived(
		!isLoginPage &&
			shouldShowDatabaseMigrationWarning(
				data.appVersionInfo?.database ?? null,
				data.appVersionError
			)
	);
	let currentSection = $derived.by(() => {
		const path = $page.url.pathname;
		if (path === '/library') {
			const raw = $page.url.searchParams.get('shelf');
			if (!raw) {
				return 'Library';
			}
			const shelfId = Number.parseInt(raw, 10);
			if (!Number.isInteger(shelfId) || shelfId <= 0) {
				return 'Library';
			}
			return shelfStore.shelves.find((shelf) => shelf.id === shelfId)?.name ?? 'Library';
		}
		if (path === '/queue') return 'Queue';
		if (path === '/search') return 'Search';
		if (path === '/stats') return 'Stats';
		if (path === '/archived') return 'Archived';
		if (path === '/trash') return 'Trash';
		if (path === '/logs') return 'Logs';
		return path === '/' ? 'Login' : path.slice(1).replace(/-/g, ' ');
	});

	function openModal() {
		error = null;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		username = '';
		password = '';
		authMode = 'password';
		error = null;
	}

	async function handleLogin() {
		if (!username || !password) {
			return;
		}

		isLoading = true;
		error = null;

		if (authMode === 'remix') {
			const result = await ZLibAuthService.tokenLogin(username, password);
			if (!result.ok) {
				error = result.error;
			} else {
				zlibName = ZLibAuthService.getStoredUserName();
				closeModal();
			}
		} else {
			const result = await ZLibAuthService.passwordLogin(
				username,
				password,
			);
			if (result.ok) {
				zlibName = result.value.user.name;
				closeModal();
			} else {
				error = result.error;
			}
		}

		isLoading = false;
	}

	async function handleZLibraryLogout() {
		if (isLoggingOutZLibrary) {
			return;
		}

		isLoggingOutZLibrary = true;
		const result = await ZLibAuthService.logout();
		isLoggingOutZLibrary = false;

		if (!result.ok) {
			toastStore.add(`Failed to log out from Z-Library: ${result.error.message}`, 'error');
			return;
		}

		zlibName = '';
		toastStore.add('Logged out from Z-Library', 'success');
	}

	function handleSidebarToggle() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(
				SIDEBAR_COLLAPSED_KEY,
				String(sidebarCollapsed),
			);
		}
	}

	function toggleMobileSidebar() {
		sidebarMobileOpen = !sidebarMobileOpen;
	}

	onMount(() => {
		const handleZlibraryAuthCleared = () => {
			zlibName = "";
		};
		if (typeof window !== 'undefined') {
			window.addEventListener(ZLIBRARY_AUTH_CLEARED_EVENT_NAME, handleZlibraryAuthCleared);
		}

		(async () => {
			if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
				void navigator.serviceWorker
					.register('/service-worker.js', { type: 'module' })
					.catch((error: unknown) => {
						console.error('Service worker registration failed', error);
					});
			}

			zlibName = ZLibAuthService.getStoredUserName();

			// Restore sidebar state
			if (typeof localStorage !== 'undefined') {
				sidebarCollapsed =
					localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
			}

			if (!isLoginPage) {
				await shelfStore.load();
			}

		})();

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener(ZLIBRARY_AUTH_CLEARED_EVENT_NAME, handleZlibraryAuthCleared);
			}
		};
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link
		rel="preconnect"
		href="https://fonts.gstatic.com"
		crossorigin="anonymous"
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<ToastContainer />

<div
	class="app-layout"
	class:with-sidebar={!isLoginPage}
	class:sidebar-collapsed={sidebarCollapsed}
>
	{#if !isLoginPage}
		<Sidebar
			bind:collapsed={sidebarCollapsed}
			bind:mobileOpen={sidebarMobileOpen}
			{zlibName}
			{isLoggingOutZLibrary}
			onOpenZLibraryLogin={openModal}
			onLogoutZLibrary={() => void handleZLibraryLogout()}
			onToggle={handleSidebarToggle}
		/>
	{/if}

	<div class="main-content">
		{#if !isLoginPage}
			<AppTopBar
				currentSection={currentSection}
				onToggleMobileSidebar={toggleMobileSidebar}
			/>
		{/if}

		<main class="content">
			{#if showDatabaseMigrationWarning && databaseMigrationWarning}
				<div class="database-migration-warning" role="alert">
					<strong>Database migration required.</strong>
					<span>{databaseMigrationWarning}</span>
				</div>
			{/if}
			{@render children()}
		</main>
	</div>
</div>

{#if sidebarMobileOpen && !isLoginPage}
	<MobileSidebarBackdrop onClose={() => (sidebarMobileOpen = false)} />
{/if}

{#if showModal}
	<ZLibraryAuthModal
		bind:username
		bind:password
		bind:authMode
		{isLoading}
		{error}
		onClose={closeModal}
		onSubmit={handleLogin}
	/>
{/if}

<style>
	:global(:root) {
		--font-ui: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
		--font-mono: "JetBrains Mono", "SFMono-Regular", ui-monospace, monospace;
		--sidebar-width: 16rem;
		--sidebar-collapsed-width: 4.5rem;

		--color-background: #0d0f14;
		--color-sidebar: #111318;
		--color-surface: #161921;
		--color-surface-2: #1a1d27;
		--color-border: rgba(255, 255, 255, 0.08);

		--color-text-primary: #e8e6e3;
		--color-text-secondary: #c4c1bb;
		--color-text-muted: #7a7872;

		--color-primary: #c9a962;
		--color-primary-foreground: #0d1013;
		--color-accent: #c9a962;
		--color-accent-strong: #d9be82;
		--color-success: #4ade80;
		--color-danger: #c4443a;
	}

	:global(html),
	:global(body) {
		margin: 0;
		padding: 0;
		overflow-x: hidden;
		background: var(--color-background);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(h1),
	:global(h2),
	:global(h3),
	:global(h4) {
		font-weight: 600;
		letter-spacing: 0;
	}

	.app-layout {
		min-height: 100vh;
	}

	.app-layout.with-sidebar .main-content {
		--main-content-offset: var(--sidebar-width);

		margin-left: var(--sidebar-width);
		transition: margin-left 0.2s ease;
	}

	.app-layout.with-sidebar.sidebar-collapsed .main-content {
		--main-content-offset: var(--sidebar-collapsed-width);

		margin-left: var(--sidebar-collapsed-width);
	}

	.main-content {
		--main-content-offset: 0px;

		display: flex;
		flex-direction: column;
		height: 100vh;
		min-height: 100vh;
	}

	.content {
		flex: 1;
		margin: 0;
		padding: 0 1rem;
		width: 100%;
		overflow-y: auto;
	}

	.database-migration-warning {
		display: grid;
		gap: 0.28rem;
		margin: 1rem 0 0;
		padding: 0.9rem 1rem;
		border-radius: 0.8rem;
		border: 1px solid rgba(220, 38, 38, 0.4);
		background:
			linear-gradient(135deg, rgba(127, 29, 29, 0.2), rgba(69, 10, 10, 0.3)),
			rgba(38, 12, 12, 0.9);
		color: #fecaca;
		box-shadow: 0 10px 24px -18px rgba(127, 29, 29, 0.8);
	}

	.database-migration-warning strong {
		font-size: 0.92rem;
		font-weight: 700;
		color: #fee2e2;
	}

	.database-migration-warning span {
		font-size: 0.84rem;
		line-height: 1.5;
	}

	@media (max-width: 900px) {
		.app-layout.with-sidebar .main-content,
		.app-layout.with-sidebar.sidebar-collapsed .main-content {
			margin-left: 0;
		}
	}

	@media (max-width: 640px) {
		.content {
			padding: 0 0.85rem;
		}
	}
</style>
