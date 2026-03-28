<script lang="ts">
	import { onMount } from 'svelte';
	import AppWindowIcon from '$lib/assets/icons/AppWindowIcon.svelte';
	import LogInIcon from '$lib/assets/icons/LogInIcon.svelte';
	import SmartphoneIcon from '$lib/assets/icons/SmartphoneIcon.svelte';
	import UserCircleIcon from '$lib/assets/icons/UserCircleIcon.svelte';
	import XIcon from '$lib/assets/icons/XIcon.svelte';
	import SidebarSettingsAppPane from '../SidebarSettingsAppPane/SidebarSettingsAppPane.svelte';
	import SidebarSettingsAccountPane from '../SidebarSettingsAccountPane/SidebarSettingsAccountPane.svelte';
	import SidebarSettingsDevicesPane from '../SidebarSettingsDevicesPane/SidebarSettingsDevicesPane.svelte';
	import SidebarSettingsLoginsPane from '../SidebarSettingsLoginsPane/SidebarSettingsLoginsPane.svelte';
	import styles from './SidebarSettingsModal.module.scss';
	import type { AuthApiKey } from '$lib/types/Auth/ApiKey';
	import type { CurrentUser } from '$lib/types/Auth/CurrentUser';
	import type { RegisteredDevice } from '$lib/types/Auth/Device';

	interface SettingsSection {
		id: string;
		label: string;
	}

	interface Props {
		open?: boolean;
		sections: readonly SettingsSection[];
		activeSection?: string;
		zlibName: string;
		showZLibraryLogin: boolean;
		isLoggingOutZLibrary?: boolean;
		currentUser: CurrentUser | null;
		currentUserError: string | null;
		isLoadingCurrentUser?: boolean;
		apiKeys: AuthApiKey[];
		apiKeysError: string | null;
		isLoadingApiKeys?: boolean;
		revokingApiKeyId: number | null;
		devices: RegisteredDevice[];
		devicesError: string | null;
		isLoadingDevices?: boolean;
		deletingDeviceId: string | null;
		appVersion: string;
		appEnvironment: string;
		appSourceUrl: string;
		appSourceLabel: string;
		formatDateTime: (value: string | null) => string;
		onClose: () => void;
		onOpenZLibraryLogin: () => void;
		onLogoutZLibrary: () => void;
		onRefreshApiKeys: () => void;
		onRevokeApiKey: (apiKeyId: number, deviceId: string) => void;
		onRefreshDevices: () => void;
		onDeleteDevice: (deviceId: string) => void;
		onLogout: () => void;
		onLogoutAll: () => void;
		isLoggingOut?: boolean;
		isLoggingOutEverywhere?: boolean;
	}

	let {
		open = false,
		sections,
		activeSection = $bindable('app'),
		zlibName,
		showZLibraryLogin,
		isLoggingOutZLibrary = false,
		currentUser,
		currentUserError,
		isLoadingCurrentUser = false,
		apiKeys,
		apiKeysError,
		isLoadingApiKeys = false,
		revokingApiKeyId,
		devices,
		devicesError,
		isLoadingDevices = false,
		deletingDeviceId,
		appVersion,
		appEnvironment,
		appSourceUrl,
		appSourceLabel,
		formatDateTime,
		onClose,
		onOpenZLibraryLogin,
		onLogoutZLibrary,
		onRefreshApiKeys,
		onRevokeApiKey,
		onRefreshDevices,
		onDeleteDevice,
		onLogout,
		onLogoutAll,
		isLoggingOut = false,
		isLoggingOutEverywhere = false
	}: Props = $props();

	let modalEl = $state<HTMLDivElement | null>(null);

	onMount(() => {
		if (open) {
			modalEl?.focus();
		}
	});

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}

	function getSectionIcon(sectionId: string) {
		if (sectionId === 'app') {
			return AppWindowIcon;
		}
		if (sectionId === 'logins') {
			return LogInIcon;
		}
		if (sectionId === 'devices') {
			return SmartphoneIcon;
		}
		return UserCircleIcon;
	}
</script>

{#if open}
	<div class={styles.overlay} role="presentation" onclick={onClose}>
		<div bind:this={modalEl} class={styles.modal} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" tabindex="-1" onclick={(event) => event.stopPropagation()} onkeydown={handleKeydown}>
			<div class="settings-modal-header">
				<h3 id="settings-modal-title">Settings</h3>
				<button type="button" class="settings-modal-close" aria-label="Close settings modal" onclick={onClose}>
					<XIcon size={18} decorative={true} />
				</button>
			</div>
			<div class="settings-modal-layout">
				<nav class="settings-modal-nav" aria-label="Settings sections">
					{#each sections as section}
						{@const SectionIcon = getSectionIcon(section.id)}
						<button type="button" class={`settings-nav-btn ${activeSection === section.id ? 'active' : ''}`} onclick={() => (activeSection = section.id)}>
							<span class="settings-nav-icon" aria-hidden="true">
								<SectionIcon size={21} decorative={true} />
							</span>
							<span class="settings-nav-label">{section.label}</span>
						</button>
					{/each}
				</nav>
				<div class="settings-modal-body">
					{#if activeSection === 'app'}
						<SidebarSettingsAppPane {appVersion} {appEnvironment} appSourceUrl={appSourceUrl} appSourceLabel={appSourceLabel} />
					{:else if activeSection === 'logins'}
						<SidebarSettingsLoginsPane
							{zlibName}
							{showZLibraryLogin}
							{isLoggingOutZLibrary}
							onOpenZLibraryLogin={onOpenZLibraryLogin}
							onLogoutZLibrary={onLogoutZLibrary}
						/>
					{:else if activeSection === 'account'}
						<SidebarSettingsAccountPane
							{currentUser}
							{currentUserError}
							{isLoadingCurrentUser}
							{apiKeys}
							{apiKeysError}
							{isLoadingApiKeys}
							{revokingApiKeyId}
							{formatDateTime}
							onRefreshApiKeys={onRefreshApiKeys}
							onRevokeApiKey={onRevokeApiKey}
							onLogout={onLogout}
							onLogoutAll={onLogoutAll}
							{isLoggingOut}
							{isLoggingOutEverywhere}
						/>
					{:else if activeSection === 'devices'}
						<SidebarSettingsDevicesPane
							{devices}
							{devicesError}
							{isLoadingDevices}
							{deletingDeviceId}
							{formatDateTime}
							onRefresh={onRefreshDevices}
							onDelete={onDeleteDevice}
						/>
					{:else}
						<SidebarSettingsAppPane {appVersion} {appEnvironment} appSourceUrl={appSourceUrl} appSourceLabel={appSourceLabel} />
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
