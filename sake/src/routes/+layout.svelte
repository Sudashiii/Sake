<script lang="ts">
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import { ZUI } from "$lib/client/zui";
	import { ZLibAuthService } from "$lib/client/services/zlibAuthService";
	import Sidebar from "$lib/components/sidebar/Sidebar/Sidebar.svelte";
	import AppTopBar from "$lib/components/layout/AppTopBar/AppTopBar.svelte";
	import MobileSidebarBackdrop from "$lib/components/layout/MobileSidebarBackdrop/MobileSidebarBackdrop.svelte";
	import ToastContainer from "$lib/components/ToastContainer/ToastContainer.svelte";
	import ZLibraryAuthModal from "$lib/components/layout/ZLibraryAuthModal/ZLibraryAuthModal.svelte";
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
			<AppTopBar
				currentSection={currentSection}
				zlibName={zlibName}
				onToggleMobileSidebar={toggleMobileSidebar}
				onOpenAuthModal={openModal}
				onLogout={handleLogout}
			/>
		{/if}

		<main class="content">
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

	.content {
		flex: 1;
		margin: 0;
		padding: 0 1rem;
		width: 100%;
		overflow-y: auto;
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
