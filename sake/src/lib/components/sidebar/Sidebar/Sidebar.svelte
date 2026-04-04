<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ChevronLeftIcon from '$lib/assets/icons/ChevronLeftIcon.svelte';
	import ChevronRightIcon from '$lib/assets/icons/ChevronRightIcon.svelte';
	import SettingsIcon from '$lib/assets/icons/SettingsIcon.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal/ConfirmModal.svelte';
	import ShelfRulesModal from '$lib/components/shelfRules/ShelfRulesModal/ShelfRulesModal.svelte';
	import SidebarNavItem from '$lib/components/sidebar/SidebarNavItem/SidebarNavItem.svelte';
	import SidebarShelfContextMenu from '$lib/components/sidebar/SidebarShelfContextMenu/SidebarShelfContextMenu.svelte';
	import SidebarShelvesSection from '$lib/components/sidebar/SidebarShelvesSection/SidebarShelvesSection.svelte';
	import SidebarSettingsModal from '$lib/components/sidebar/SidebarSettingsModal/SidebarSettingsModal.svelte';
	import SakeLogo from '$lib/assets/svg/SakeLogo.svelte';
	import { getMenuItems, type MenuItem } from '$lib/types/Navigation';
	import {
		getSidebarSettingsSections,
		SidebarSettingsController
	} from './sidebarSettingsController.svelte';
	import { SidebarShelfManager } from './sidebarShelfManager.svelte';
	import styles from './Sidebar.module.scss';

	interface Props {
		collapsed?: boolean;
		mobileOpen?: boolean;
		zlibName: string;
		isLoggingOutZLibrary?: boolean;
		onOpenZLibraryLogin: () => void;
		onLogoutZLibrary: () => void;
		onToggle?: () => void;
	}

	let {
		collapsed = $bindable(false),
		mobileOpen = $bindable(false),
		zlibName,
		isLoggingOutZLibrary = false,
		onOpenZLibraryLogin,
		onLogoutZLibrary,
		onToggle
	}: Props = $props();

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

	const shelfManager = new SidebarShelfManager({
		getSelectedShelfId: () => selectedShelfId,
		onSelectedShelfRemoved: () => goto('/library')
	});
	const settingsController = new SidebarSettingsController();

	let shelves = $derived.by(() => shelfManager.shelves);
	let isLibraryActive = $derived($page.url.pathname === '/library');
	let visibleMenuItems = $derived(getMenuItems($page.data.searchEnabled));
	let showZLibraryLogin = $derived($page.data.activeSearchProviders.includes('zlibrary'));
	let settingsSections = $derived(getSidebarSettingsSections(showZLibraryLogin));

	$effect(() => {
		settingsController.syncActiveSection(showZLibraryLogin);
	});

	function isActive(item: MenuItem): boolean {
		return $page.url.pathname === item.href || $page.url.pathname.startsWith(item.href + '/');
	}

	function handleToggle(): void {
		collapsed = !collapsed;
		onToggle?.();
	}

	async function navigateToShelf(shelfId: number): Promise<void> {
		mobileOpen = false;
		await goto(`/library?shelf=${shelfId}`);
	}

	async function handleAppLogout(): Promise<void> {
		const didLogout = await settingsController.handleAppLogout();
		if (!didLogout) {
			return;
		}
		mobileOpen = false;
		await goto('/');
	}

	async function handleLogoutAllSessions(): Promise<void> {
		const didLogout = await settingsController.handleLogoutAllSessions();
		if (!didLogout) {
			return;
		}
		mobileOpen = false;
		await goto('/');
	}

	onMount(() => {
		return shelfManager.mount();
	});
</script>

<aside class={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
	<div class={styles.sidebarHeader}>
		{#if !collapsed}
			<div class={styles.logo}>
				<span class={styles.logoIcon} aria-hidden="true"><SakeLogo size={28} decorative={true} /></span>
				<span class={styles.logoText}>Sake</span>
			</div>
		{/if}
		<button class={styles.toggleBtn} onclick={handleToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
			{#if collapsed}
				<ChevronRightIcon size={18} decorative={true} />
			{:else}
				<ChevronLeftIcon size={18} decorative={true} />
			{/if}
		</button>
	</div>

	<nav class={styles.sidebarNav}>
		<ul>
			{#each visibleMenuItems as item (item.id)}
				<li>
					{#if item.id === 'library' && !collapsed}
						<div class={styles.libraryRow}>
							<SidebarNavItem item={item} active={isActive(item)} onClick={() => (mobileOpen = false)} />
							<button type="button" class={styles.libraryExpandBtn} aria-label={shelfManager.shelvesExpanded ? 'Collapse shelves' : 'Expand shelves'} onclick={() => (shelfManager.shelvesExpanded = !shelfManager.shelvesExpanded)}>
								<ChevronRightIcon size={13} class={`${styles.expandIcon} ${shelfManager.shelvesExpanded ? styles.expanded : ''}`} decorative={true} />
							</button>
						</div>
					{:else}
						<SidebarNavItem item={item} active={isActive(item)} collapsed={collapsed} onClick={() => (mobileOpen = false)} />
					{/if}

					{#if item.id === 'library' && !collapsed && shelfManager.shelvesExpanded}
						<SidebarShelvesSection
							{shelves}
							selectedShelfId={selectedShelfId}
							isLibraryActive={isLibraryActive}
							showCreateShelf={shelfManager.showCreateShelf}
							bind:newShelfName={shelfManager.newShelfName}
							bind:newShelfIcon={shelfManager.newShelfIcon}
							bind:showCreateEmojiPicker={shelfManager.showCreateEmojiPicker}
							editingShelfId={shelfManager.editingShelfId}
							bind:editShelfName={shelfManager.editShelfName}
							bind:editShelfIcon={shelfManager.editShelfIcon}
							bind:showEditEmojiPicker={shelfManager.showEditEmojiPicker}
							emojiOptions={shelfManager.emojiOptions}
							isMutatingShelves={shelfManager.isMutatingShelves}
							isReorderingShelves={shelfManager.isReorderingShelves}
							draggingShelfId={shelfManager.draggingShelfId}
							shelfDragOverId={shelfManager.shelfDragOverId}
							getShelfRuleCount={shelfManager.getShelfRuleCount}
							onStartCreateShelf={shelfManager.startCreateShelf}
							onCreateShelf={() => void shelfManager.handleCreateShelf()}
							onCancelCreateShelf={shelfManager.cancelCreateShelf}
							onToggleCreateEmojiPicker={() => (shelfManager.showCreateEmojiPicker = !shelfManager.showCreateEmojiPicker)}
							onSelectCreateEmoji={(emoji) => {
								shelfManager.newShelfIcon = emoji;
								shelfManager.showCreateEmojiPicker = false;
							}}
							onRenameShelf={(shelfId) => void shelfManager.handleRenameShelf(shelfId)}
							onCancelRenameShelf={shelfManager.cancelRenameShelf}
							onToggleEditEmojiPicker={() => (shelfManager.showEditEmojiPicker = !shelfManager.showEditEmojiPicker)}
							onSelectEditEmoji={(emoji) => {
								shelfManager.editShelfIcon = emoji;
								shelfManager.showEditEmojiPicker = false;
							}}
							onShelfPointerDown={shelfManager.handleShelfPointerDown}
							onSelectShelf={(shelfId) => void navigateToShelf(shelfId)}
							onOpenShelfMenu={shelfManager.openShelfMenu}
							shouldIgnoreShelfClick={shelfManager.shouldIgnoreShelfClick}
						/>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>

	<div class={styles.sidebarFooter}>
		<button type="button" class={styles.sidebarFooterBtn} title={collapsed ? 'Settings' : undefined} aria-label="Open settings" onclick={settingsController.openModal}>
			<span class={styles.icon}><SettingsIcon size={20} decorative={true} /></span>
			{#if !collapsed}
				<span class={styles.label}>Settings</span>
			{/if}
		</button>
	</div>
</aside>

{#if shelfManager.shelfMenuId !== null && shelfManager.shelfMenuPos !== null}
	{@const menuShelf = shelves.find((shelf) => shelf.id === shelfManager.shelfMenuId)}
	{#if menuShelf}
		<SidebarShelfContextMenu shelf={menuShelf} position={shelfManager.shelfMenuPos} ruleCount={shelfManager.getShelfRuleCount(menuShelf)} onClose={shelfManager.closeAllShelfMenus} onRename={() => shelfManager.startRenameShelf(menuShelf)} onRules={() => shelfManager.openRulesModal(menuShelf.id)} onDelete={() => shelfManager.requestDeleteShelf(menuShelf)} />
	{/if}
{/if}

<ConfirmModal open={shelfManager.showDeleteShelfModal} title="Delete shelf?" message="Books stay in your library. Only shelf assignments will be removed." confirmLabel="Delete" cancelLabel="Cancel" danger={true} pending={shelfManager.isMutatingShelves} onConfirm={shelfManager.confirmDeleteShelf} onCancel={shelfManager.cancelDeleteShelf} />

<ConfirmModal
	open={settingsController.showDeleteDeviceModal}
	title="Delete device?"
	message={settingsController.pendingDeleteDeviceId ? `Delete device "${settingsController.pendingDeleteDeviceId}"? This revokes its API key, removes its download acknowledgements, and clears its progress-download tracking.` : 'Delete this device?'}
	confirmLabel="Delete device"
	cancelLabel="Cancel"
	danger={true}
	pending={settingsController.deletingDeviceId !== null}
	onConfirm={settingsController.confirmDeleteDevice}
	onCancel={settingsController.cancelDeleteDevice}
/>

{#if shelfManager.rulesModalShelfId !== null}
	{@const rulesShelf = shelves.find((shelf) => shelf.id === shelfManager.rulesModalShelfId)}
	{#if rulesShelf}
		<ShelfRulesModal open={true} shelfName={rulesShelf.name} shelfIcon={rulesShelf.icon} initialRuleGroup={rulesShelf.ruleGroup} pending={shelfManager.isSavingShelfRules} onClose={shelfManager.closeRulesModal} onSave={shelfManager.handleSaveShelfRules} />
	{/if}
{/if}

<SidebarSettingsModal
	open={settingsController.showSettingsModal}
	sections={settingsSections}
	bind:activeSection={settingsController.activeSection}
	{zlibName}
	{showZLibraryLogin}
	{isLoggingOutZLibrary}
	currentUser={settingsController.currentUser}
	currentUserError={settingsController.currentUserError}
	isLoadingCurrentUser={settingsController.isLoadingCurrentUser}
	apiKeys={settingsController.apiKeys}
	apiKeysError={settingsController.apiKeysError}
	isLoadingApiKeys={settingsController.isLoadingApiKeys}
	revokingApiKeyId={settingsController.revokingApiKeyId}
	devices={settingsController.devices}
	devicesError={settingsController.devicesError}
	isLoadingDevices={settingsController.isLoadingDevices}
	deletingDeviceId={settingsController.deletingDeviceId}
	appVersion={settingsController.appVersion}
	databaseVersion={settingsController.databaseVersion}
	appVersionError={settingsController.appVersionError}
	isLoadingAppVersion={settingsController.isLoadingAppVersion}
	appEnvironment={settingsController.appEnvironment}
	appSourceUrl={settingsController.appSourceUrl}
	appSourceLabel={settingsController.appSourceLabel}
	formatDateTime={settingsController.formatDateTime}
	onClose={settingsController.closeModal}
	onOpenZLibraryLogin={onOpenZLibraryLogin}
	onLogoutZLibrary={onLogoutZLibrary}
	onRefreshApiKeys={() => void settingsController.loadAuthApiKeys()}
	onRevokeApiKey={(apiKeyId, deviceId) => void settingsController.handleRevokeApiKey(apiKeyId, deviceId)}
	onRefreshDevices={() => void settingsController.loadDevices()}
	onDeleteDevice={settingsController.requestDeleteDevice}
	onLogout={() => void handleAppLogout()}
	onLogoutAll={() => void handleLogoutAllSessions()}
	isLoggingOut={settingsController.isLoggingOut}
	isLoggingOutEverywhere={settingsController.isLoggingOutEverywhere}
/>
