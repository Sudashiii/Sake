<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import ShelfRulesModal from '$lib/components/ShelfRulesModal.svelte';
	import SakeLogo from '$lib/assets/svg/SakeLogo.svelte';
	import { ZUI } from '$lib/client/zui';
	import { toastStore } from '$lib/client/stores/toastStore.svelte';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';
	import type { RuleGroup } from '$lib/types/Library/ShelfRule';
	import { countRuleConditions } from '$lib/types/Library/ShelfRule';
	import { menuItems, type MenuItem } from '$lib/types/Navigation';

	interface Props {
		collapsed?: boolean;
		mobileOpen?: boolean;
		onToggle?: () => void;
	}

	const EMOJI_OPTIONS = ['📚', '⭐', '🚀', '📌', '🔥', '💎', '🎯', '📖', '🌙', '🎨', '💡', '🏆', '❤️', '🌊', '⚡', '🦋'];

	let {
		collapsed = $bindable(false),
		mobileOpen = $bindable(false),
		onToggle
	}: Props = $props();

	let shelves = $state<LibraryShelf[]>([]);
	let shelvesExpanded = $state(true);
	let isMutatingShelves = $state(false);
	let showCreateShelf = $state(false);
	let newShelfName = $state('');
	let newShelfIcon = $state('📚');
	let showCreateEmojiPicker = $state(false);
	let editingShelfId = $state<number | null>(null);
	let editShelfName = $state('');
	let editShelfIcon = $state('📚');
	let showEditEmojiPicker = $state(false);
	let shelfMenuId = $state<number | null>(null);
	let shelfMenuPos = $state<{ top: number; left: number } | null>(null);
	let newShelfInputEl = $state<HTMLInputElement | null>(null);
	let editShelfInputEl = $state<HTMLInputElement | null>(null);
	let showDeleteShelfModal = $state(false);
	let pendingDeleteShelfId = $state<number | null>(null);
	let rulesModalShelfId = $state<number | null>(null);
	let isSavingShelfRules = $state(false);

	let selectedShelfId = $derived.by(() => {
		if ($page.url.pathname !== '/library') {
			return null;
		}
		const raw = $page.url.searchParams.get('shelf');
		if (!raw) {
			return null;
		}
		const parsed = Number.parseInt(raw, 10);
		return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
	});

	let isLibraryActive = $derived($page.url.pathname === '/library');

	$effect(() => {
		if (showCreateShelf) {
			newShelfInputEl?.focus();
		}
	});

	$effect(() => {
		if (editingShelfId !== null) {
			editShelfInputEl?.focus();
		}
	});

	function emitShelvesChanged(): void {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('shelves:changed'));
		}
	}

	function isActive(item: MenuItem): boolean {
		return $page.url.pathname === item.href || $page.url.pathname.startsWith(item.href + '/');
	}

	function handleToggle() {
		collapsed = !collapsed;
		onToggle?.();
	}

	async function navigateToShelf(shelfId: number): Promise<void> {
		mobileOpen = false;
		await goto(`/library?shelf=${shelfId}`);
	}

	function closeAllShelfMenus(): void {
		showCreateEmojiPicker = false;
		showEditEmojiPicker = false;
		shelfMenuId = null;
		shelfMenuPos = null;
	}

	function getShelfRuleCount(shelf: LibraryShelf): number {
		return countRuleConditions(shelf.ruleGroup);
	}

	async function loadShelves(): Promise<void> {
		const result = await ZUI.getLibraryShelves();
		if (!result.ok) {
			return;
		}
		shelves = result.value.shelves;
		if (selectedShelfId !== null && !shelves.some((shelf) => shelf.id === selectedShelfId)) {
			void goto('/library');
		}
	}

	function startCreateShelf(): void {
		showCreateShelf = true;
		newShelfName = '';
		newShelfIcon = '📚';
		showCreateEmojiPicker = false;
		editingShelfId = null;
	}

	function cancelCreateShelf(): void {
		showCreateShelf = false;
		newShelfName = '';
		showCreateEmojiPicker = false;
	}

	async function handleCreateShelf(): Promise<void> {
		const name = newShelfName.trim();
		if (!name || isMutatingShelves) {
			return;
		}
		isMutatingShelves = true;
		const result = await ZUI.createLibraryShelf({ name, icon: newShelfIcon });
		isMutatingShelves = false;
		if (!result.ok) {
			toastStore.add(`Failed to create shelf: ${result.error.message}`, 'error');
			return;
		}
		showCreateShelf = false;
		closeAllShelfMenus();
		await loadShelves();
		emitShelvesChanged();
		toastStore.add(`Shelf "${result.value.shelf.name}" created`, 'success');
	}

	function startRenameShelf(shelf: LibraryShelf): void {
		editingShelfId = shelf.id;
		editShelfName = shelf.name;
		editShelfIcon = shelf.icon;
		showEditEmojiPicker = false;
		shelfMenuId = null;
		shelfMenuPos = null;
	}

	function cancelRenameShelf(): void {
		editingShelfId = null;
		editShelfName = '';
		editShelfIcon = '📚';
		showEditEmojiPicker = false;
	}

	async function handleRenameShelf(shelfId: number): Promise<void> {
		const name = editShelfName.trim();
		if (!name || isMutatingShelves) {
			return;
		}
		isMutatingShelves = true;
		const result = await ZUI.updateLibraryShelf(shelfId, { name, icon: editShelfIcon });
		isMutatingShelves = false;
		if (!result.ok) {
			toastStore.add(`Failed to rename shelf: ${result.error.message}`, 'error');
			return;
		}
		const updatedName = result.value.shelf.name;
		cancelRenameShelf();
		await loadShelves();
		emitShelvesChanged();
		toastStore.add(`Shelf renamed to "${updatedName}"`, 'success');
	}

	function requestDeleteShelf(shelf: LibraryShelf): void {
		pendingDeleteShelfId = shelf.id;
		showDeleteShelfModal = true;
		shelfMenuId = null;
		shelfMenuPos = null;
	}

	function cancelDeleteShelf(): void {
		showDeleteShelfModal = false;
		pendingDeleteShelfId = null;
	}

	async function confirmDeleteShelf(): Promise<void> {
		if (pendingDeleteShelfId === null || isMutatingShelves) {
			return;
		}

		const shelf = shelves.find((item) => item.id === pendingDeleteShelfId);
		if (!shelf) {
			cancelDeleteShelf();
			return;
		}

		if (isMutatingShelves) {
			return;
		}

		isMutatingShelves = true;
		const result = await ZUI.deleteLibraryShelf(shelf.id);
		isMutatingShelves = false;
		if (!result.ok) {
			toastStore.add(`Failed to delete shelf: ${result.error.message}`, 'error');
			return;
		}

		if (selectedShelfId === shelf.id) {
			await goto('/library');
		}

		closeAllShelfMenus();
		await loadShelves();
		emitShelvesChanged();
		toastStore.add(`Shelf "${shelf.name}" deleted`, 'success');
		cancelDeleteShelf();
	}

	function openShelfMenu(event: MouseEvent, shelfId: number): void {
		event.stopPropagation();
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		shelfMenuPos = { top: rect.top - 2, left: rect.right - 10 };
		shelfMenuId = shelfMenuId === shelfId ? null : shelfId;
	}

	function openRulesModal(shelfId: number): void {
		rulesModalShelfId = shelfId;
		closeAllShelfMenus();
	}

	function closeRulesModal(): void {
		if (!isSavingShelfRules) {
			rulesModalShelfId = null;
		}
	}

	async function handleSaveShelfRules(ruleGroup: RuleGroup): Promise<void> {
		if (rulesModalShelfId === null || isSavingShelfRules) {
			return;
		}

		isSavingShelfRules = true;
		const result = await ZUI.updateLibraryShelfRules(rulesModalShelfId, ruleGroup);
		isSavingShelfRules = false;

		if (!result.ok) {
			toastStore.add(`Failed to update shelf rules: ${result.error.message}`, 'error');
			return;
		}

		shelves = shelves.map((shelf) =>
			shelf.id === result.value.shelf.id ? result.value.shelf : shelf
		);
		emitShelvesChanged();
		rulesModalShelfId = null;
		toastStore.add(`Rules updated for "${result.value.shelf.name}"`, 'success');
	}

	onMount(() => {
		void loadShelves();
		const handleShelvesChanged = () => {
			void loadShelves();
		};
		if (typeof window !== 'undefined') {
			window.addEventListener('shelves:changed', handleShelvesChanged);
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('shelves:changed', handleShelvesChanged);
			}
		};
	});
</script>

<aside class="sidebar" class:collapsed class:mobile-open={mobileOpen}>
	<div class="sidebar-header">
		{#if !collapsed}
			<div class="logo">
				<span class="logo-icon" aria-hidden="true">
					<SakeLogo size={18} decorative={true} />
				</span>
				<span class="logo-text">Sake</span>
			</div>
		{/if}
		<button class="toggle-btn" onclick={handleToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
			{#if collapsed}
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="15 18 9 12 15 6"></polyline>
				</svg>
			{/if}
		</button>
	</div>

	<nav class="sidebar-nav">
		<ul>
			{#each menuItems as item (item.id)}
				<li>
					{#if item.id === 'library' && !collapsed}
						<div class="library-row">
							<a
								href={item.href}
								class:active={isActive(item)}
								onclick={() => (mobileOpen = false)}
							>
								<span class="icon">
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="m16 6 4 14"></path>
										<path d="M12 6v14"></path>
										<path d="M8 8v12"></path>
										<path d="M4 4v16"></path>
									</svg>
								</span>
								<span class="label">{item.label}</span>
							</a>
							<button
								type="button"
								class="library-expand-btn"
								aria-label={shelvesExpanded ? 'Collapse shelves' : 'Expand shelves'}
								onclick={() => (shelvesExpanded = !shelvesExpanded)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="13"
									height="13"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class:expanded={shelvesExpanded}
								>
									<polyline points="9 18 15 12 9 6"></polyline>
								</svg>
							</button>
						</div>
					{:else}
						<a
							href={item.href}
							class:active={isActive(item)}
							title={collapsed ? item.label : undefined}
							onclick={() => (mobileOpen = false)}
						>
							<span class="icon">
								{#if item.icon === 'search'}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="11" cy="11" r="8"></circle>
										<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
									</svg>
								{:else if item.icon === 'library'}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="m16 6 4 14"></path>
										<path d="M12 6v14"></path>
										<path d="M8 8v12"></path>
										<path d="M4 4v16"></path>
									</svg>
								{:else if item.icon === 'queue'}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M16 3h5v5"></path>
										<path d="M4 20l17-17"></path>
										<path d="M21 16v5h-5"></path>
										<path d="M15 21l6-6"></path>
										<path d="M3 8V3h5"></path>
										<path d="M3 3l6 6"></path>
									</svg>
								{:else if item.icon === 'stats'}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="12" y1="20" x2="12" y2="10"></line>
										<line x1="18" y1="20" x2="18" y2="4"></line>
										<line x1="6" y1="20" x2="6" y2="16"></line>
									</svg>
								{:else if item.icon === 'archive'}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="21 8 21 21 3 21 3 8"></polyline>
										<rect x="1" y="3" width="22" height="5"></rect>
										<line x1="10" y1="12" x2="14" y2="12"></line>
									</svg>
								{:else if item.icon === 'trash'}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="3 6 5 6 21 6"></polyline>
										<path d="M19 6l-1 14H6L5 6"></path>
										<path d="M10 11v6"></path>
										<path d="M14 11v6"></path>
										<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
									</svg>
								{:else if item.icon === 'book'}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
										<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
									</svg>
								{:else if item.icon === 'settings'}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="12" cy="12" r="3"></circle>
										<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
									</svg>
								{:else if item.icon === 'home'}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
										<polyline points="9 22 9 12 15 12 15 22"></polyline>
									</svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
										<polyline points="14 2 14 8 20 8"></polyline>
									</svg>
								{/if}
							</span>
							{#if !collapsed}
								<span class="label">{item.label}</span>
							{/if}
						</a>
					{/if}
					{#if item.id === 'library' && !collapsed && shelvesExpanded}
						<div class="shelves-subnav">
							<div class="shelves-subnav-header">
								<span class="shelves-title">Shelves</span>
								<button
									type="button"
									class="shelf-add-btn"
									onclick={startCreateShelf}
									disabled={isMutatingShelves}
									aria-label="Create shelf"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
										<line x1="12" y1="5" x2="12" y2="19"></line>
										<line x1="5" y1="12" x2="19" y2="12"></line>
									</svg>
								</button>
							</div>
							<div class="shelves-list">
								{#each shelves as shelf (shelf.id)}
									{#if editingShelfId === shelf.id}
										<div class="shelf-row shelf-row-editing">
											<div class="shelf-edit-row">
												<div class="shelf-emoji-picker-wrap">
													<span class="shelf-icon shelf-icon-edit" aria-hidden="true">{editShelfIcon}</span>
													<button
														type="button"
														class="shelf-emoji-hitbox"
														aria-label="Select shelf icon"
														onclick={() => (showEditEmojiPicker = !showEditEmojiPicker)}
													></button>
													{#if showEditEmojiPicker}
														<button
															type="button"
															class="menu-backdrop"
															aria-label="Close emoji picker"
															onclick={() => (showEditEmojiPicker = false)}
														></button>
														<div class="shelf-emoji-menu">
															{#each EMOJI_OPTIONS as emoji}
																<button
																	type="button"
																	class="shelf-emoji-option"
																	class:active={editShelfIcon === emoji}
																	onclick={() => {
																		editShelfIcon = emoji;
																		showEditEmojiPicker = false;
																	}}
																>
																	{emoji}
																</button>
															{/each}
														</div>
													{/if}
												</div>
												<input
													bind:this={editShelfInputEl}
													bind:value={editShelfName}
													class="shelf-edit-input"
													onkeydown={(event) => {
														if (event.key === 'Enter') {
															void handleRenameShelf(shelf.id);
														}
														if (event.key === 'Escape') {
															cancelRenameShelf();
														}
													}}
												/>
												<button type="button" class="shelf-inline-btn save" onclick={() => void handleRenameShelf(shelf.id)}>
													Save
												</button>
												<button type="button" class="shelf-inline-btn cancel" onclick={cancelRenameShelf}>
													✕
												</button>
											</div>
											<span class="shelf-row-btn shelf-row-btn-placeholder" aria-hidden="true"></span>
										</div>
									{:else}
										<div class="shelf-row">
											<button
												type="button"
												class="shelf-link shelf-link-btn"
												class:active={isLibraryActive && selectedShelfId === shelf.id}
												onclick={() => void navigateToShelf(shelf.id)}
											>
												<span class="shelf-icon">{shelf.icon}</span>
												<span class="shelf-name">{shelf.name}</span>
												{#if getShelfRuleCount(shelf) > 0}
													<span class="shelf-rule-indicator" aria-hidden="true">
														<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
															<polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4"></polygon>
														</svg>
													</span>
												{/if}
											</button>
											<button
												type="button"
												class="shelf-row-btn"
												onclick={(event) => openShelfMenu(event, shelf.id)}
												aria-label={`Open menu for ${shelf.name}`}
											>
												<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
													<circle cx="12" cy="12" r="1"></circle>
													<circle cx="19" cy="12" r="1"></circle>
													<circle cx="5" cy="12" r="1"></circle>
												</svg>
											</button>
										</div>
									{/if}
								{/each}

								{#if showCreateShelf}
									<div class="shelf-edit-row">
										<div class="shelf-emoji-picker-wrap">
											<span class="shelf-icon shelf-icon-edit" aria-hidden="true">{newShelfIcon}</span>
											<button
												type="button"
												class="shelf-emoji-hitbox"
												aria-label="Select shelf icon"
												onclick={() => (showCreateEmojiPicker = !showCreateEmojiPicker)}
											></button>
											{#if showCreateEmojiPicker}
												<button
													type="button"
													class="menu-backdrop"
													aria-label="Close emoji picker"
													onclick={() => (showCreateEmojiPicker = false)}
												></button>
												<div class="shelf-emoji-menu">
													{#each EMOJI_OPTIONS as emoji}
														<button
															type="button"
															class="shelf-emoji-option"
															class:active={newShelfIcon === emoji}
															onclick={() => {
																newShelfIcon = emoji;
																showCreateEmojiPicker = false;
															}}
														>
															{emoji}
														</button>
													{/each}
												</div>
											{/if}
										</div>
										<input
											bind:this={newShelfInputEl}
											bind:value={newShelfName}
											class="shelf-edit-input"
											placeholder="Shelf name"
											onkeydown={(event) => {
												if (event.key === 'Enter') {
													void handleCreateShelf();
												}
												if (event.key === 'Escape') {
													cancelCreateShelf();
												}
											}}
										/>
										<button type="button" class="shelf-inline-btn save" onclick={() => void handleCreateShelf()}>
											Add
										</button>
										<button type="button" class="shelf-inline-btn cancel" onclick={cancelCreateShelf}>
											✕
										</button>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>

	<div class="sidebar-footer">
		{#if !collapsed}
			<span class="version">v0.1.0</span>
		{/if}
	</div>
</aside>

{#if shelfMenuId !== null && shelfMenuPos !== null}
	{@const menuShelf = shelves.find((shelf) => shelf.id === shelfMenuId)}
	{#if menuShelf}
		<button
			type="button"
			class="menu-backdrop"
			aria-label="Close shelf menu"
			onclick={closeAllShelfMenus}
		></button>
		<div class="shelf-context-menu" style={`top: ${shelfMenuPos.top}px; left: ${shelfMenuPos.left}px;`}>
			<button
				type="button"
				class="shelf-context-item"
				onclick={() => startRenameShelf(menuShelf)}
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 20h9"></path>
					<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
				</svg>
				Rename
			</button>
			<button
				type="button"
				class="shelf-context-item"
				onclick={() => openRulesModal(menuShelf.id)}
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4"></polygon>
				</svg>
				Rules
				{#if getShelfRuleCount(menuShelf) > 0}
					<span class="shelf-context-count">{getShelfRuleCount(menuShelf)}</span>
				{/if}
			</button>
			<div class="shelf-context-separator"></div>
			<button
				type="button"
				class="shelf-context-item danger"
				onclick={() => requestDeleteShelf(menuShelf)}
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="3 6 5 6 21 6"></polyline>
					<path d="M19 6l-1 14H6L5 6"></path>
					<path d="M10 11v6"></path>
					<path d="M14 11v6"></path>
					<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
				</svg>
				Delete
			</button>
		</div>
	{/if}
{/if}

<ConfirmModal
	open={showDeleteShelfModal}
	title="Delete shelf?"
	message="Books stay in your library. Only shelf assignments will be removed."
	confirmLabel="Delete"
	cancelLabel="Cancel"
	danger={true}
	pending={isMutatingShelves}
	onConfirm={confirmDeleteShelf}
	onCancel={cancelDeleteShelf}
/>

{#if rulesModalShelfId !== null}
	{@const rulesShelf = shelves.find((shelf) => shelf.id === rulesModalShelfId)}
	{#if rulesShelf}
		<ShelfRulesModal
			open={true}
			shelfName={rulesShelf.name}
			shelfIcon={rulesShelf.icon}
			initialRuleGroup={rulesShelf.ruleGroup}
			pending={isSavingShelfRules}
			onClose={closeRulesModal}
			onSave={handleSaveShelfRules}
		/>
	{/if}
{/if}

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		width: var(--sidebar-width);
		height: 100vh;
		position: fixed;
		left: 0;
		top: 0;
		z-index: 100;
		background: var(--color-sidebar);
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		transition: width 0.2s ease;
		overflow-x: hidden;
	}

	.sidebar.collapsed {
		width: var(--sidebar-collapsed-width);
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 4rem;
		padding: 0 0.75rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
	}

	.logo-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.35rem;
		height: 2.35rem;
		background: transparent;
		border: none;
		border-radius: 0;
		color: inherit;
	}

	.logo-text {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-primary);
		white-space: nowrap;
	}

	.toggle-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 0.52rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: #1a1d27;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.toggle-btn:hover {
		color: var(--color-text-primary);
		border-color: rgba(255, 255, 255, 0.16);
	}

	.sidebar.collapsed .sidebar-header {
		justify-content: center;
		padding: 0 0.35rem;
	}

	.sidebar-nav {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0.8rem 0.5rem;
	}

	.sidebar-nav ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.2rem;
	}

	.menu-backdrop {
		position: fixed;
		inset: 0;
		background: transparent;
		border: 0;
		padding: 0;
		margin: 0;
		z-index: 140;
	}

	.sidebar-nav a {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.62rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		text-decoration: none;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		transition: background 0.16s ease, color 0.16s ease;
	}

	.sidebar-nav a:hover {
		background: rgba(255, 255, 255, 0.035);
		color: var(--color-text-primary);
	}

	.sidebar-nav a.active {
		background: rgba(255, 255, 255, 0.09);
		color: var(--color-text-primary);
		border-color: transparent;
	}

	.library-row {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.library-row > a {
		flex: 1;
		min-width: 0;
	}

	.library-expand-btn {
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 0.4rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.library-expand-btn:hover {
		background: rgba(255, 255, 255, 0.035);
		color: var(--color-text-primary);
	}

	.library-expand-btn svg {
		transition: transform 0.18s ease;
	}

	.library-expand-btn svg.expanded {
		transform: rotate(90deg);
	}

	.shelves-subnav {
		margin: 0.25rem 0 0 1rem;
		width: calc(100% - 1rem);
		padding-left: 0.75rem;
		border-left: 1px solid rgba(255, 255, 255, 0.1);
		display: grid;
		gap: 0.25rem;
		box-sizing: border-box;
	}

	.shelves-subnav-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
	}

	.shelves-title {
		font-size: 0.72rem;
		color: var(--color-text-muted);
	}

	.shelf-add-btn {
		width: 1.45rem;
		height: 1.45rem;
		border-radius: 0.35rem;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.shelf-add-btn:hover {
		color: var(--color-text-primary);
	}

	.shelf-add-btn:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.shelves-list {
		display: grid;
		gap: 0.125rem;
		min-width: 0;
	}

	.shelf-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		position: relative;
		width: 100%;
		min-width: 0;
		height: 1.9rem;
		box-sizing: border-box;
	}

	.shelf-link-btn {
		width: 100%;
		min-width: 0;
		border: none;
		background: transparent;
		font-family: inherit;
		cursor: pointer;
		text-align: left;
	}

	.shelf-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		height: 100%;
		padding: 0 0.5rem;
		border-radius: 0.5rem;
		color: color-mix(in oklab, var(--color-text-primary), transparent 30%);
		text-decoration: none;
		font-size: 0.75rem;
		line-height: 1;
		transition: background 0.16s ease, color 0.16s ease;
	}

	.shelf-link:hover {
		background: rgba(255, 255, 255, 0.035);
		color: var(--color-text-primary);
	}

	.shelf-link.active {
		background: rgba(255, 255, 255, 0.09);
		color: var(--color-text-primary);
	}

	.shelf-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		font-size: 0.75rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.shelf-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.shelf-rule-indicator {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 0.72rem;
		height: 0.72rem;
		margin-left: auto;
		flex-shrink: 0;
		color: color-mix(in oklab, var(--color-text-muted), var(--color-primary) 28%);
		opacity: 0.52;
	}

	.shelf-row-btn {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.4rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.16s ease, background 0.16s ease, color 0.16s ease;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.shelf-row:hover .shelf-row-btn {
		opacity: 1;
	}

	.shelf-row-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-primary);
	}

	.shelf-row-btn:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.shelf-edit-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		height: 1.9rem;
		box-sizing: border-box;
		padding: 0 0.5rem;
		border-radius: 0.42rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid transparent;
		overflow: visible;
	}

	.shelf-row-editing .shelf-edit-row {
		flex: 1;
		width: auto;
	}

	.shelf-row-btn-placeholder {
		opacity: 0;
		pointer-events: none;
	}

	.shelf-emoji-picker-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.shelf-emoji-hitbox {
		position: absolute;
		inset: 0;
		border-radius: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		padding: 0;
		margin: 0;
		appearance: none;
	}

	.shelf-icon-edit {
		transform: none;
	}

	.shelf-emoji-menu {
		position: absolute;
		top: calc(100% + 0.3rem);
		left: 0;
		z-index: 160;
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: 0.18rem;
		padding: 0.45rem;
		min-width: 12rem;
		border-radius: 0.52rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		box-shadow: 0 14px 28px rgba(0, 0, 0, 0.36);
	}

	.shelf-emoji-option {
		width: 1.35rem;
		height: 1.35rem;
		border: 1px solid transparent;
		border-radius: 0.3rem;
		background: transparent;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
	}

	.shelf-emoji-option:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.shelf-emoji-option.active {
		border-color: color-mix(in oklab, var(--color-primary), transparent 55%);
		background: color-mix(in oklab, var(--color-primary), transparent 88%);
	}

	.shelf-edit-input {
		flex: 1;
		min-width: 0;
		width: 0;
		background: transparent;
		border: none;
		outline: none;
		padding: 0;
		margin: 0;
		color: var(--color-text-primary);
		font-size: 0.75rem;
		line-height: 1;
		font-family: inherit;
	}

	.shelf-inline-btn {
		border: none;
		background: transparent;
		padding: 0.18rem 0.35rem;
		min-width: 1.55rem;
		height: 1.28rem;
		color: var(--color-text-muted);
		font-size: 0.64rem;
		cursor: pointer;
		flex-shrink: 0;
		line-height: 1;
		border-radius: 0.3rem;
		white-space: nowrap;
	}

	.shelf-inline-btn.save {
		color: var(--color-primary);
	}

	.shelf-inline-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-primary);
	}

	.shelf-inline-btn.cancel:hover {
		color: var(--color-text-primary);
	}

	.shelf-context-menu {
		position: fixed;
		z-index: 145;
		min-width: 8.125rem;
		padding: 0.25rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		background: color-mix(in oklab, var(--color-surface), white 4%);
		box-shadow: 0 14px 26px rgba(0, 0, 0, 0.42);
		display: grid;
		gap: 0.08rem;
	}

	.shelf-context-item {
		border: none;
		background: transparent;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-align: left;
		padding: 0.375rem 0.75rem;
		border-radius: 0.4rem;
		color: var(--color-text-primary);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.shelf-context-count {
		margin-left: auto;
		font-size: 0.62rem;
		color: color-mix(in oklab, var(--color-primary), white 10%);
	}

	.shelf-context-item:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-primary);
	}

	.shelf-context-item.danger {
		color: #ffb4ad;
	}

	.shelf-context-item.danger:hover {
		background: rgba(196, 68, 58, 0.2);
	}

	.shelf-context-separator {
		height: 1px;
		background: var(--color-border);
		margin: 0.16rem 0.24rem;
	}

	.sidebar.collapsed .sidebar-nav a {
		justify-content: center;
		padding: 0.62rem;
		gap: 0;
	}

	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.1rem;
		height: 1.1rem;
		flex-shrink: 0;
	}

	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sidebar-footer {
		height: 2.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		padding: 0 0.6rem;
	}

	.version {
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	@media (max-width: 900px) {
		.sidebar {
			width: min(84vw, 300px);
			transform: translateX(-105%);
			transition: transform 0.25s ease;
			z-index: 130;
		}

		.sidebar.mobile-open {
			transform: translateX(0);
		}

		.sidebar.collapsed {
			width: min(84vw, 300px);
		}

		.sidebar.collapsed .logo {
			display: inline-flex;
		}

		.sidebar.collapsed .label {
			display: inline;
		}

		.sidebar.collapsed .sidebar-nav a {
			justify-content: flex-start;
			gap: 0.65rem;
		}

		.toggle-btn {
			display: none;
		}
	}
</style>
