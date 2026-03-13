<script lang="ts">
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { env } from '$env/dynamic/public';
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
	import { AuthService } from '$lib/client/services/authService';
	import { ZLibAuthService } from '$lib/client/services/zlibAuthService';
	import { toastStore } from '$lib/client/stores/toastStore.svelte';
	import { ZUI } from '$lib/client/zui';
	import type { AuthApiKey } from '$lib/types/Auth/ApiKey';
	import type { RegisteredDevice } from '$lib/types/Auth/Device';
	import type { CurrentUser } from '$lib/types/Auth/CurrentUser';
	import type { LibraryShelf } from '$lib/types/Library/Shelf';
	import type { RuleGroup } from '$lib/types/Library/ShelfRule';
	import { countRuleConditions } from '$lib/types/Library/ShelfRule';
	import { getMenuItems, type MenuItem } from '$lib/types/Navigation';
	import { createWebappVersion } from '$lib/webappVersion';
	import styles from './Sidebar.module.scss';

	interface Props {
		collapsed?: boolean;
		mobileOpen?: boolean;
		onToggle?: () => void;
	}

	const EMOJI_OPTIONS = ['📚', '⭐', '🚀', '📌', '🔥', '💎', '🎯', '📖', '🌙', '🎨', '💡', '🏆', '❤️', '🌊', '⚡', '🦋'];
	const SHELF_REORDER_LONG_PRESS_MS = 360;
	const SHELF_DRAG_CANCEL_DISTANCE_PX = 8;
	const appVersion = createWebappVersion({ version: env.PUBLIC_WEBAPP_VERSION });
	const appEnvironment = dev ? 'Development' : 'Production';
	const APP_SOURCE_URL = 'https://github.com/Sudashiii/Sake';
	const APP_SOURCE_LABEL = 'https://github.com/Sudashiii/Sake';
	const SETTINGS_SECTIONS = [
		{ id: 'app', label: 'App' },
		{ id: 'account', label: 'Account' },
		{ id: 'devices', label: 'Devices' }
	] as const;

	type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

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
	let showDeleteShelfModal = $state(false);
	let pendingDeleteShelfId = $state<number | null>(null);
	let rulesModalShelfId = $state<number | null>(null);
	let isSavingShelfRules = $state(false);
	let showSettingsModal = $state(false);
	let previouslyFocusedSettingsElement = $state<HTMLElement | null>(null);
	let activeSettingsSection = $state<SettingsSectionId>('app');
	let currentUser = $state<CurrentUser | null>(null);
	let currentUserError = $state<string | null>(null);
	let isLoadingCurrentUser = $state(false);
	let apiKeys = $state<AuthApiKey[]>([]);
	let apiKeysError = $state<string | null>(null);
	let isLoadingApiKeys = $state(false);
	let revokingApiKeyId = $state<number | null>(null);
	let devices = $state<RegisteredDevice[]>([]);
	let devicesError = $state<string | null>(null);
	let isLoadingDevices = $state(false);
	let deletingDeviceId = $state<string | null>(null);
	let pendingDeleteDeviceId = $state<string | null>(null);
	let showDeleteDeviceModal = $state(false);
	let isLoggingOut = $state(false);
	let isLoggingOutEverywhere = $state(false);
	let isReorderingShelves = $state(false);
	let draggingShelfId = $state<number | null>(null);
	let shelfDragOverId = $state<number | null>(null);

	let pressedShelfId: number | null = null;
	let pressedPointerId: number | null = null;
	let pressedStartX = 0;
	let pressedStartY = 0;
	let shelfPressTimer: ReturnType<typeof setTimeout> | null = null;
	let shelfOrderBeforeDrag: LibraryShelf[] | null = null;
	let blockShelfClickUntil = 0;

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
	let visibleMenuItems = $derived(getMenuItems($page.data.searchEnabled));

	function emitShelvesChanged(): void {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('shelves:changed'));
		}
	}

	function isActive(item: MenuItem): boolean {
		return $page.url.pathname === item.href || $page.url.pathname.startsWith(item.href + '/');
	}

	function handleToggle(): void {
		collapsed = !collapsed;
		onToggle?.();
	}

	function openSettingsModal(): void {
		previouslyFocusedSettingsElement =
			typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
		showSettingsModal = true;
		activeSettingsSection = 'app';
		void loadCurrentUser();
		void loadAuthApiKeys();
		void loadDevices();
	}

	function closeSettingsModal(): void {
		showSettingsModal = false;
		activeSettingsSection = 'app';
		cancelDeleteDevice();
		previouslyFocusedSettingsElement?.focus();
		previouslyFocusedSettingsElement = null;
	}

	function formatDateTime(value: string | null): string {
		if (!value) {
			return 'Never';
		}

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			return value;
		}

		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	async function loadAuthApiKeys(): Promise<void> {
		if (isLoadingApiKeys) {
			return;
		}
		isLoadingApiKeys = true;
		apiKeysError = null;
		const result = await ZUI.getAuthApiKeys();
		isLoadingApiKeys = false;
		if (!result.ok) {
			apiKeys = [];
			apiKeysError = result.error.message;
			return;
		}
		apiKeys = result.value.apiKeys;
	}

	async function loadDevices(): Promise<void> {
		if (isLoadingDevices) {
			return;
		}
		isLoadingDevices = true;
		devicesError = null;
		const result = await ZUI.getDevices();
		isLoadingDevices = false;
		if (!result.ok) {
			devices = [];
			devicesError = result.error.message;
			return;
		}
		devices = result.value.devices;
	}

	async function loadCurrentUser(): Promise<void> {
		if (isLoadingCurrentUser) {
			return;
		}
		isLoadingCurrentUser = true;
		currentUserError = null;
		const result = await AuthService.restoreSession();
		isLoadingCurrentUser = false;
		if (!result.ok) {
			currentUser = null;
			currentUserError = result.error.message;
			return;
		}
		currentUser = result.value;
	}

	async function handleRevokeApiKey(apiKeyId: number, deviceId: string): Promise<void> {
		if (revokingApiKeyId !== null) {
			return;
		}
		revokingApiKeyId = apiKeyId;
		const result = await ZUI.revokeAuthApiKey(apiKeyId);
		revokingApiKeyId = null;
		if (!result.ok) {
			toastStore.add(`Failed to revoke API key: ${result.error.message}`, 'error');
			return;
		}
		apiKeys = apiKeys.filter((apiKey) => apiKey.id !== apiKeyId);
		toastStore.add(`Revoked API key for ${deviceId}`, 'success');
		void loadDevices();
	}

	function requestDeleteDevice(deviceId: string): void {
		if (deletingDeviceId !== null) {
			return;
		}
		pendingDeleteDeviceId = deviceId;
		showDeleteDeviceModal = true;
	}

	function cancelDeleteDevice(): void {
		showDeleteDeviceModal = false;
		pendingDeleteDeviceId = null;
	}

	async function confirmDeleteDevice(): Promise<void> {
		if (!pendingDeleteDeviceId || deletingDeviceId !== null) {
			return;
		}

		deletingDeviceId = pendingDeleteDeviceId;
		const result = await ZUI.deleteDevice(pendingDeleteDeviceId);
		deletingDeviceId = null;

		if (!result.ok) {
			toastStore.add(`Failed to delete device: ${result.error.message}`, 'error');
			return;
		}

		const deletedDeviceId = result.value.deviceId;
		cancelDeleteDevice();
		await Promise.all([loadDevices(), loadAuthApiKeys()]);
		toastStore.add(`Deleted device "${deletedDeviceId}"`, 'success');
	}

	async function handleAppLogout(): Promise<void> {
		if (isLoggingOut) {
			return;
		}
		isLoggingOut = true;
		const result = await AuthService.logout();
		isLoggingOut = false;
		if (!result.ok) {
			toastStore.add(`Failed to log out: ${result.error.message}`, 'error');
			return;
		}
		ZLibAuthService.clearUserName();
		closeSettingsModal();
		mobileOpen = false;
		await goto('/');
	}

	async function handleLogoutAllSessions(): Promise<void> {
		if (isLoggingOutEverywhere) {
			return;
		}
		isLoggingOutEverywhere = true;
		const result = await AuthService.logoutAllSessions();
		isLoggingOutEverywhere = false;
		if (!result.ok) {
			toastStore.add(`Failed to log out all sessions: ${result.error.message}`, 'error');
			return;
		}
		ZLibAuthService.clearUserName();
		closeSettingsModal();
		mobileOpen = false;
		await goto('/');
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

	function clearShelfPressTimer(): void {
		if (shelfPressTimer !== null) {
			clearTimeout(shelfPressTimer);
			shelfPressTimer = null;
		}
	}

	function setShelfDragDocumentState(active: boolean): void {
		if (typeof document === 'undefined') {
			return;
		}
		document.body.classList.toggle('shelf-reorder-active', active);
	}

	function resetShelfDragState(): void {
		draggingShelfId = null;
		shelfDragOverId = null;
		shelfOrderBeforeDrag = null;
		setShelfDragDocumentState(false);
	}

	function resetShelfPressState(): void {
		clearShelfPressTimer();
		pressedShelfId = null;
		pressedPointerId = null;
		pressedStartX = 0;
		pressedStartY = 0;
	}

	function shouldIgnoreShelfClick(): boolean {
		return Date.now() < blockShelfClickUntil || draggingShelfId !== null;
	}

	function getShelfIdFromPoint(clientX: number, clientY: number): number | null {
		if (typeof document === 'undefined') {
			return null;
		}
		const target = document.elementFromPoint(clientX, clientY);
		if (!target) {
			return null;
		}
		const shelfNode = target.closest('[data-shelf-id]') as HTMLElement | null;
		const rawShelfId = shelfNode?.dataset.shelfId;
		if (!rawShelfId) {
			return null;
		}
		const parsedShelfId = Number.parseInt(rawShelfId, 10);
		return Number.isInteger(parsedShelfId) && parsedShelfId > 0 ? parsedShelfId : null;
	}

	function reorderShelvesLocally(draggedShelfId: number, targetShelfId: number): void {
		const fromIndex = shelves.findIndex((shelf) => shelf.id === draggedShelfId);
		const toIndex = shelves.findIndex((shelf) => shelf.id === targetShelfId);
		if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
			return;
		}
		const nextShelves = [...shelves];
		const [draggedShelf] = nextShelves.splice(fromIndex, 1);
		if (!draggedShelf) {
			return;
		}
		nextShelves.splice(toIndex, 0, draggedShelf);
		shelves = nextShelves;
	}

	async function persistShelfReorder(previousShelves: LibraryShelf[]): Promise<void> {
		const shelfIds = shelves.map((shelf) => shelf.id);
		isReorderingShelves = true;
		const result = await ZUI.reorderLibraryShelves(shelfIds);
		isReorderingShelves = false;
		resetShelfDragState();
		if (!result.ok) {
			shelves = previousShelves;
			toastStore.add(`Failed to reorder shelves: ${result.error.message}`, 'error');
			return;
		}
		shelves = result.value.shelves;
		emitShelvesChanged();
	}

	function startShelfDrag(shelfId: number): void {
		if (draggingShelfId !== null || isMutatingShelves || isReorderingShelves) {
			return;
		}
		draggingShelfId = shelfId;
		shelfDragOverId = shelfId;
		shelfOrderBeforeDrag = [...shelves];
		blockShelfClickUntil = Date.now() + 500;
		closeAllShelfMenus();
		setShelfDragDocumentState(true);
	}

	function handleShelfPointerDown(event: PointerEvent, shelfId: number): void {
		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}
		if (isMutatingShelves || isReorderingShelves || editingShelfId !== null || showCreateShelf) {
			return;
		}
		resetShelfPressState();
		pressedShelfId = shelfId;
		pressedPointerId = event.pointerId;
		pressedStartX = event.clientX;
		pressedStartY = event.clientY;
		shelfPressTimer = setTimeout(() => {
			if (pressedShelfId === shelfId && pressedPointerId === event.pointerId) {
				startShelfDrag(shelfId);
			}
		}, SHELF_REORDER_LONG_PRESS_MS);
	}

	function handleGlobalPointerMove(event: PointerEvent): void {
		if (pressedPointerId === null || event.pointerId !== pressedPointerId) {
			return;
		}
		if (draggingShelfId === null) {
			const movedX = Math.abs(event.clientX - pressedStartX);
			const movedY = Math.abs(event.clientY - pressedStartY);
			if (movedX > SHELF_DRAG_CANCEL_DISTANCE_PX || movedY > SHELF_DRAG_CANCEL_DISTANCE_PX) {
				resetShelfPressState();
			}
			return;
		}
		event.preventDefault();
		const targetShelfId = getShelfIdFromPoint(event.clientX, event.clientY);
		if (targetShelfId === null) {
			shelfDragOverId = null;
			return;
		}
		shelfDragOverId = targetShelfId;
		if (targetShelfId !== draggingShelfId) {
			reorderShelvesLocally(draggingShelfId, targetShelfId);
		}
	}

	function handleGlobalPointerUp(event: PointerEvent): void {
		if (pressedPointerId === null || event.pointerId !== pressedPointerId) {
			return;
		}
		clearShelfPressTimer();
		const wasDragging = draggingShelfId !== null;
		const previousShelves = shelfOrderBeforeDrag ? [...shelfOrderBeforeDrag] : null;
		resetShelfPressState();
		if (!wasDragging) {
			return;
		}
		blockShelfClickUntil = Date.now() + 500;
		const orderChanged =
			previousShelves !== null &&
			(previousShelves.length !== shelves.length ||
				previousShelves.some((shelf, index) => shelf.id !== shelves[index]?.id));
		if (!orderChanged || previousShelves === null) {
			resetShelfDragState();
			return;
		}
		void persistShelfReorder(previousShelves);
	}

	async function loadShelves(): Promise<void> {
		if (draggingShelfId !== null) {
			return;
		}
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
		if (isReorderingShelves || draggingShelfId !== null) {
			return;
		}
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
		if (!name || isMutatingShelves || isReorderingShelves) {
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
		if (draggingShelfId !== null || isReorderingShelves) {
			return;
		}
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
		if (!name || isMutatingShelves || isReorderingShelves) {
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
		if (pendingDeleteShelfId === null || isMutatingShelves || isReorderingShelves) {
			return;
		}
		const shelf = shelves.find((item) => item.id === pendingDeleteShelfId);
		if (!shelf) {
			cancelDeleteShelf();
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
		if (draggingShelfId !== null || isReorderingShelves) {
			return;
		}
		event.stopPropagation();
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		shelfMenuPos = { top: rect.top - 2, left: rect.right - 10 };
		shelfMenuId = shelfMenuId === shelfId ? null : shelfId;
	}

	function openRulesModal(shelfId: number): void {
		if (draggingShelfId !== null || isReorderingShelves) {
			return;
		}
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
			window.addEventListener('pointermove', handleGlobalPointerMove);
			window.addEventListener('pointerup', handleGlobalPointerUp);
			window.addEventListener('pointercancel', handleGlobalPointerUp);
		}
		return () => {
			resetShelfPressState();
			resetShelfDragState();
			if (typeof window !== 'undefined') {
				window.removeEventListener('shelves:changed', handleShelvesChanged);
				window.removeEventListener('pointermove', handleGlobalPointerMove);
				window.removeEventListener('pointerup', handleGlobalPointerUp);
				window.removeEventListener('pointercancel', handleGlobalPointerUp);
			}
		};
	});
</script>

<aside class={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
	<div class={styles.sidebarHeader}>
		{#if !collapsed}
			<div class={styles.logo}>
				<span class={styles.logoIcon} aria-hidden="true"><SakeLogo size={18} decorative={true} /></span>
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
							<button type="button" class={styles.libraryExpandBtn} aria-label={shelvesExpanded ? 'Collapse shelves' : 'Expand shelves'} onclick={() => (shelvesExpanded = !shelvesExpanded)}>
								<ChevronRightIcon size={13} class={`${styles.expandIcon} ${shelvesExpanded ? styles.expanded : ''}`} decorative={true} />
							</button>
						</div>
					{:else}
						<SidebarNavItem item={item} active={isActive(item)} collapsed={collapsed} onClick={() => (mobileOpen = false)} />
					{/if}

					{#if item.id === 'library' && !collapsed && shelvesExpanded}
						<SidebarShelvesSection
							{shelves}
							selectedShelfId={selectedShelfId}
							isLibraryActive={isLibraryActive}
							showCreateShelf={showCreateShelf}
							bind:newShelfName={newShelfName}
							bind:newShelfIcon={newShelfIcon}
							bind:showCreateEmojiPicker={showCreateEmojiPicker}
							editingShelfId={editingShelfId}
							bind:editShelfName={editShelfName}
							bind:editShelfIcon={editShelfIcon}
							bind:showEditEmojiPicker={showEditEmojiPicker}
							emojiOptions={EMOJI_OPTIONS}
							isMutatingShelves={isMutatingShelves}
							isReorderingShelves={isReorderingShelves}
							draggingShelfId={draggingShelfId}
							shelfDragOverId={shelfDragOverId}
							getShelfRuleCount={getShelfRuleCount}
							onStartCreateShelf={startCreateShelf}
							onCreateShelf={() => void handleCreateShelf()}
							onCancelCreateShelf={cancelCreateShelf}
							onToggleCreateEmojiPicker={() => (showCreateEmojiPicker = !showCreateEmojiPicker)}
							onSelectCreateEmoji={(emoji) => {
								newShelfIcon = emoji;
								showCreateEmojiPicker = false;
							}}
							onRenameShelf={(shelfId) => void handleRenameShelf(shelfId)}
							onCancelRenameShelf={cancelRenameShelf}
							onToggleEditEmojiPicker={() => (showEditEmojiPicker = !showEditEmojiPicker)}
							onSelectEditEmoji={(emoji) => {
								editShelfIcon = emoji;
								showEditEmojiPicker = false;
							}}
							onShelfPointerDown={handleShelfPointerDown}
							onSelectShelf={(shelfId) => void navigateToShelf(shelfId)}
							onOpenShelfMenu={openShelfMenu}
							shouldIgnoreShelfClick={shouldIgnoreShelfClick}
						/>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>

	<div class={styles.sidebarFooter}>
		<button type="button" class={styles.sidebarFooterBtn} title={collapsed ? 'Settings' : undefined} aria-label="Open settings" onclick={openSettingsModal}>
			<span class={styles.icon}><SettingsIcon size={20} decorative={true} /></span>
			{#if !collapsed}
				<span class={styles.label}>Settings</span>
			{/if}
		</button>
	</div>
</aside>

{#if shelfMenuId !== null && shelfMenuPos !== null}
	{@const menuShelf = shelves.find((shelf) => shelf.id === shelfMenuId)}
	{#if menuShelf}
		<SidebarShelfContextMenu shelf={menuShelf} position={shelfMenuPos} ruleCount={getShelfRuleCount(menuShelf)} onClose={closeAllShelfMenus} onRename={() => startRenameShelf(menuShelf)} onRules={() => openRulesModal(menuShelf.id)} onDelete={() => requestDeleteShelf(menuShelf)} />
	{/if}
{/if}

<ConfirmModal open={showDeleteShelfModal} title="Delete shelf?" message="Books stay in your library. Only shelf assignments will be removed." confirmLabel="Delete" cancelLabel="Cancel" danger={true} pending={isMutatingShelves} onConfirm={confirmDeleteShelf} onCancel={cancelDeleteShelf} />

<ConfirmModal
	open={showDeleteDeviceModal}
	title="Delete device?"
	message={pendingDeleteDeviceId ? `Delete device "${pendingDeleteDeviceId}"? This revokes its API key, removes its download acknowledgements, and clears its progress-download tracking.` : 'Delete this device?'}
	confirmLabel="Delete device"
	cancelLabel="Cancel"
	danger={true}
	pending={deletingDeviceId !== null}
	onConfirm={confirmDeleteDevice}
	onCancel={cancelDeleteDevice}
/>

{#if rulesModalShelfId !== null}
	{@const rulesShelf = shelves.find((shelf) => shelf.id === rulesModalShelfId)}
	{#if rulesShelf}
		<ShelfRulesModal open={true} shelfName={rulesShelf.name} shelfIcon={rulesShelf.icon} initialRuleGroup={rulesShelf.ruleGroup} pending={isSavingShelfRules} onClose={closeRulesModal} onSave={handleSaveShelfRules} />
	{/if}
{/if}

<SidebarSettingsModal
	open={showSettingsModal}
	sections={SETTINGS_SECTIONS}
	bind:activeSection={activeSettingsSection}
	{currentUser}
	{currentUserError}
	{isLoadingCurrentUser}
	{apiKeys}
	{apiKeysError}
	{isLoadingApiKeys}
	{revokingApiKeyId}
	{devices}
	{devicesError}
	{isLoadingDevices}
	{deletingDeviceId}
	appVersion={appVersion.version}
	{appEnvironment}
	appSourceUrl={APP_SOURCE_URL}
	appSourceLabel={APP_SOURCE_LABEL}
	{formatDateTime}
	onClose={closeSettingsModal}
	onRefreshApiKeys={() => void loadAuthApiKeys()}
	onRevokeApiKey={(apiKeyId, deviceId) => void handleRevokeApiKey(apiKeyId, deviceId)}
	onRefreshDevices={() => void loadDevices()}
	onDeleteDevice={(deviceId) => requestDeleteDevice(deviceId)}
	onLogout={() => void handleAppLogout()}
	onLogoutAll={() => void handleLogoutAllSessions()}
	{isLoggingOut}
	{isLoggingOutEverywhere}
/>
