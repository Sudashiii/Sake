<script lang="ts">
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import { ZUI } from "$lib/client/zui";
	import { ZLibAuthService } from "$lib/client/services/zlibAuthService";
	import Sidebar from "$lib/components/Sidebar.svelte";
	import ToastContainer from "$lib/components/ToastContainer.svelte";
	import type { ApiError } from "$lib/types/ApiError";
	import type { LibraryShelf } from "$lib/types/Library/Shelf";
	import type { Snippet } from "svelte";

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

	let showModal = $state(false);
	let username = $state("");
	let password = $state("");
	let zlibName = $state("");
	let authMode = $state<"password" | "remix">("password");
	let isLoading = $state(false);
	let error = $state<ApiError | null>(null);
	let sidebarCollapsed = $state(false);
	let sidebarMobileOpen = $state(false);
	let shelves = $state<LibraryShelf[]>([]);

	// Check if we're on the login page (don't show sidebar there)
	let isLoginPage = $derived($page.url.pathname === "/");
	let currentSection = $derived.by(() => {
		const path = $page.url.pathname;
		if (path === "/library") {
			const raw = $page.url.searchParams.get("shelf");
			if (!raw) {
				return "Library";
			}
			const shelfId = Number.parseInt(raw, 10);
			if (!Number.isInteger(shelfId) || shelfId <= 0) {
				return "Library";
			}
			return shelves.find((shelf) => shelf.id === shelfId)?.name ?? "Library";
		}
		if (path === "/queue") return "Queue";
		if (path === "/search") return "Search";
		if (path === "/stats") return "Stats";
		if (path === "/archived") return "Archived";
		if (path === "/trash") return "Trash";
		return path === "/" ? "Login" : path.slice(1).replace(/-/g, " ");
	});

	$effect(() => {
		if (!isLoginPage) {
			void loadShelves();
		}
	});

	function openModal() {
		error = null;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		username = "";
		password = "";
		authMode = "password";
		error = null;
	}

	async function handleLogin() {
		if (!username || !password) {
			return;
		}

		isLoading = true;
		error = null;

		if (authMode === "remix") {
			const result = await ZLibAuthService.tokenLogin(username, password);
			if (!result.ok) {
				error = result.error;
			} else {
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

	function handleLogout() {
		ZLibAuthService.clearUserName();
		zlibName = "";
	}

	function handleSidebarToggle() {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(
				SIDEBAR_COLLAPSED_KEY,
				String(sidebarCollapsed),
			);
		}
	}

	function toggleMobileSidebar() {
		sidebarMobileOpen = !sidebarMobileOpen;
	}

	function handleKeyDown(event: KeyboardEvent, action: () => void) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			action();
		}
	}

	function handleModalClick(event: MouseEvent) {
		event.stopPropagation();
	}

	async function loadShelves(): Promise<void> {
		const result = await ZUI.getLibraryShelves();
		if (result.ok) {
			shelves = result.value.shelves;
		}
	}

	onMount(() => {
		const handleShelvesChanged = () => {
			void loadShelves();
		};
		if (typeof window !== "undefined") {
			window.addEventListener("shelves:changed", handleShelvesChanged);
		}

		(async () => {
			if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
				void navigator.serviceWorker
					.register("/service-worker.js", { type: "module" })
					.catch((error: unknown) => {
						console.error("Service worker registration failed", error);
					});
			}

			zlibName = ZLibAuthService.getStoredUserName();

			// Restore sidebar state
			if (typeof localStorage !== "undefined") {
				sidebarCollapsed =
					localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
			}

		})();

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("shelves:changed", handleShelvesChanged);
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
			onToggle={handleSidebarToggle}
		/>
	{/if}

	<div class="main-content">
		{#if !isLoginPage}
			<header class="top-bar">
				<div class="top-left">
					<button
						class="mobile-menu-btn"
						onclick={toggleMobileSidebar}
						aria-label="Toggle navigation"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<line x1="3" y1="6" x2="21" y2="6"></line>
							<line x1="3" y1="12" x2="21" y2="12"></line>
							<line x1="3" y1="18" x2="21" y2="18"></line>
						</svg>
					</button>
					<span class="section-name">{currentSection}</span>
				</div>
				<div class="zlib-login">
					{#if zlibName}
						<div class="user-info">
							<span class="user-badge">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
									<circle cx="12" cy="7" r="4"></circle>
								</svg>
								{zlibName}
							</span>
							<button
								class="logout-btn"
								onclick={handleLogout}
								title="Logout from Z-Library"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
									<polyline points="16 17 21 12 16 7"></polyline>
									<line x1="21" y1="12" x2="9" y2="12"></line>
								</svg>
							</button>
						</div>
					{:else}
						<button
							class="zlib-connect-btn"
							onclick={openModal}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
								<polyline points="10 17 15 12 10 7"></polyline>
								<line x1="15" y1="12" x2="3" y2="12"></line>
							</svg>
							Connect Z-Library
						</button>
					{/if}
				</div>
			</header>
		{/if}

		<main class="content">
			{@render children()}
		</main>
	</div>
</div>

{#if sidebarMobileOpen && !isLoginPage}
	<div
		class="mobile-sidebar-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close navigation menu"
		onclick={() => (sidebarMobileOpen = false)}
		onkeydown={(e) => (e.key === "Enter" || e.key === " ") && (sidebarMobileOpen = false)}
	></div>
{/if}

{#if showModal}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={closeModal}
		onkeydown={(e) => handleKeyDown(e, closeModal)}
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={handleModalClick}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<div class="modal-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
						<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
					</svg>
				</div>
				<h2>Connect Z-Library</h2>
				<p class="modal-subtitle">Link your Z-Library account to search and download books</p>
			</div>

			{#if error}
				<div class="error">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12" y2="12"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
					<p>{error.message}</p>
				</div>
			{/if}

			<div class="auth-tabs" aria-label="Z-Library authentication mode">
				<button
					type="button"
					class="auth-tab"
					class:active={authMode === "password"}
					aria-pressed={authMode === "password"}
					onclick={() => (authMode = "password")}
				>
					Email Login
				</button>
				<button
					type="button"
					class="auth-tab"
					class:active={authMode === "remix"}
					aria-pressed={authMode === "remix"}
					onclick={() => (authMode = "remix")}
				>
					Remix Credentials
				</button>
			</div>

			<div class="form-group">
				<label for="zlib-username">
					{authMode === "remix" ? "Remix UserID" : "Email"}
				</label>
				<input 
					id="zlib-username"
					type="text" 
					bind:value={username}
					placeholder={authMode === "remix" ? "Enter your Remix UserID" : "Enter your email"}
				/>
			</div>

			<div class="form-group">
				<label for="zlib-password">
					{authMode === "remix" ? "Remix UserKey" : "Password"}
				</label>
				<input 
					id="zlib-password"
					type="password" 
					bind:value={password}
					placeholder={authMode === "remix" ? "Enter your Remix UserKey" : "Enter your password"}
				/>
			</div>

			<div class="actions">
				<button class="btn-secondary" onclick={closeModal}>Cancel</button>
				<button class="btn-primary" onclick={handleLogin} disabled={isLoading}>
					{#if isLoading}
						<span class="spinner"></span>
						Connecting...
					{:else}
						Connect
					{/if}
				</button>
			</div>
		</div>
	</div>
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
		margin-left: var(--sidebar-width);
		transition: margin-left 0.2s ease;
	}

	.app-layout.with-sidebar.sidebar-collapsed .main-content {
		margin-left: var(--sidebar-collapsed-width);
	}

	.main-content {
		display: flex;
		flex-direction: column;
		height: 100vh;
		min-height: 100vh;
	}

	.top-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 4rem;
		padding: 0 1rem;
		background: rgba(13, 15, 20, 0.95);
		border-bottom: 1px solid var(--color-border);
		position: sticky;
		top: 0;
		z-index: 40;
	}

	.top-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.section-name {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		text-transform: capitalize;
	}

	.mobile-menu-btn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 0.6rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.mobile-menu-btn:hover {
		color: var(--color-text-primary);
		border-color: rgba(255, 255, 255, 0.15);
	}

	.zlib-login {
		display: flex;
		align-items: center;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.user-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.36rem 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: var(--color-surface-2);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.logout-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.95rem;
		height: 1.95rem;
		border-radius: 0.55rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.logout-btn:hover {
		color: var(--color-text-primary);
		background: #212531;
	}

	.zlib-connect-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.44rem 0.76rem;
		border-radius: 0.58rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
	}

	.zlib-connect-btn:hover {
		filter: brightness(1.05);
	}

	.content {
		flex: 1;
		margin: 0;
		padding: 0 1rem;
		width: 100%;
		overflow-y: auto;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.68);
		backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		padding: 1rem;
		z-index: 2000;
	}

	.mobile-sidebar-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 120;
	}

	.modal {
		width: min(460px, 100%);
		border-radius: 0.95rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		padding: 1.1rem;
		display: grid;
		gap: 0.86rem;
		box-shadow: 0 22px 44px -30px rgba(0, 0, 0, 0.9);
	}

	.modal-header {
		text-align: left;
	}

	.modal-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 0.72rem;
		background: rgba(201, 169, 98, 0.15);
		border: 1px solid rgba(201, 169, 98, 0.35);
		color: var(--color-primary);
		margin-bottom: 0.56rem;
	}

	.modal h2 {
		margin: 0 0 0.18rem;
		font-size: 1.1rem;
	}

	.modal-subtitle {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.auth-tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0.2rem;
		border-radius: 0.65rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface-2);
	}

	.auth-tab {
		flex: 1;
		padding: 0.42rem 0.48rem;
		border-radius: 0.48rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.73rem;
		font-weight: 600;
		cursor: pointer;
	}

	.auth-tab.active {
		background: rgba(201, 169, 98, 0.18);
		border-color: rgba(201, 169, 98, 0.3);
		color: #f1dfb7;
	}

	.form-group {
		display: grid;
		gap: 0.4rem;
	}

	.form-group label {
		font-size: 0.74rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.modal input[type="text"],
	.modal input[type="password"] {
		width: 100%;
		padding: 0.62rem 0.72rem;
		border-radius: 0.58rem;
		border: 1px solid var(--color-border);
		background: #1b1f29;
		color: var(--color-text-primary);
		font-size: 0.84rem;
		font-family: inherit;
	}

	.modal input[type="text"]:focus,
	.modal input[type="password"]:focus {
		outline: none;
		border-color: rgba(201, 169, 98, 0.6);
		box-shadow: 0 0 0 2px rgba(201, 169, 98, 0.18);
	}

	.modal input::placeholder {
		color: var(--color-text-muted);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-primary,
	.btn-secondary {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.36rem;
		padding: 0.62rem 0.74rem;
		font-size: 0.8rem;
		font-weight: 600;
		border-radius: 0.58rem;
		border: 1px solid var(--color-border);
		cursor: pointer;
	}

	.btn-primary {
		background: var(--color-primary);
		border-color: rgba(255, 255, 255, 0.12);
		color: var(--color-primary-foreground);
	}

	.btn-primary:hover:not(:disabled) {
		filter: brightness(1.04);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: var(--color-surface-2);
		color: var(--color-text-secondary);
	}

	.btn-secondary:hover {
		color: var(--color-text-primary);
		border-color: rgba(255, 255, 255, 0.15);
	}

	.spinner {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.35);
		border-top-color: currentColor;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.58rem 0.68rem;
		border-radius: 0.58rem;
		border: 1px solid rgba(196, 68, 58, 0.45);
		background: rgba(196, 68, 58, 0.16);
		font-size: 0.77rem;
		color: #ffb4ad;
	}

	.error p {
		margin: 0;
	}

	@media (max-width: 900px) {
		.app-layout.with-sidebar .main-content,
		.app-layout.with-sidebar.sidebar-collapsed .main-content {
			margin-left: 0;
		}

		.mobile-menu-btn {
			display: inline-flex;
		}
	}

	@media (max-width: 640px) {
		.content {
			padding: 0 0.85rem;
		}

		.top-bar {
			padding: 0.5rem 0.65rem;
		}

		.zlib-connect-btn {
			padding: 0.38rem 0.58rem;
			font-size: 0.72rem;
		}

		.user-badge {
			max-width: 140px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.actions {
			flex-direction: column;
		}
	}
</style>
