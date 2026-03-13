<script lang="ts">
	import SidebarApiKeyList from '../SidebarApiKeyList/SidebarApiKeyList.svelte';
	import LogOutIcon from '$lib/assets/icons/LogOutIcon.svelte';
	import styles from './SidebarSettingsAccountPane.module.scss';
	import type { AuthApiKey } from '$lib/types/Auth/ApiKey';
	import type { CurrentUser } from '$lib/types/Auth/CurrentUser';

	interface Props {
		currentUser: CurrentUser | null;
		currentUserError: string | null;
		isLoadingCurrentUser?: boolean;
		apiKeys: AuthApiKey[];
		apiKeysError: string | null;
		isLoadingApiKeys?: boolean;
		revokingApiKeyId: number | null;
		formatDateTime: (value: string | null) => string;
		onRefreshApiKeys: () => void;
		onRevokeApiKey: (apiKeyId: number, deviceId: string) => void;
		onLogout: () => void;
		onLogoutAll: () => void;
		isLoggingOut?: boolean;
		isLoggingOutEverywhere?: boolean;
	}

	let {
		currentUser,
		currentUserError,
		isLoadingCurrentUser = false,
		apiKeys,
		apiKeysError,
		isLoadingApiKeys = false,
		revokingApiKeyId,
		formatDateTime,
		onRefreshApiKeys,
		onRevokeApiKey,
		onLogout,
		onLogoutAll,
		isLoggingOut = false,
		isLoggingOutEverywhere = false
	}: Props = $props();
</script>

<section class={styles.root}>
	<div class="settings-account-section">
		<div>
			<h4>User Account</h4>
			<p>Details for the currently signed-in Sake account.</p>
		</div>

		{#if currentUserError}
			<p class="settings-error">{currentUserError}</p>
		{:else if isLoadingCurrentUser}
			<p class="settings-empty">Loading account information...</p>
		{:else if currentUser}
			<div class="settings-account-meta-grid">
				<div><p class="settings-account-meta-label">Username</p><p class="settings-account-meta-value">{currentUser.username}</p></div>
				<div><p class="settings-account-meta-label">Status</p><p class="settings-account-meta-value">{currentUser.isDisabled ? 'Disabled' : 'Active'}</p></div>
			</div>
			<div class="settings-account-meta-grid">
				<div><p class="settings-account-meta-label">Created</p><p class="settings-account-meta-value">{formatDateTime(currentUser.createdAt)}</p></div>
				<div><p class="settings-account-meta-label">Last Login</p><p class="settings-account-meta-value">{formatDateTime(currentUser.lastLoginAt)}</p></div>
			</div>
		{:else}
			<p class="settings-empty">No account information is available.</p>
		{/if}
	</div>

	<div class="settings-divider"></div>

	<div class="settings-account-section">
		<SidebarApiKeyList
			{apiKeys}
			{apiKeysError}
			{isLoadingApiKeys}
			{revokingApiKeyId}
			{formatDateTime}
			onRefresh={onRefreshApiKeys}
			onRevoke={onRevokeApiKey}
		/>
	</div>

	<div class="settings-divider"></div>

	<div class="settings-account-section">
		<div>
			<h4>Browser Session</h4>
			<p>End the current Sake session for this browser.</p>
		</div>
		<button type="button" class="settings-logout-btn" onclick={onLogout} disabled={isLoggingOut}>
			{isLoggingOut ? 'Logging out...' : 'Log Out This Browser'}
		</button>
	</div>

	<div class="settings-divider"></div>

	<div class="settings-account-section">
		<div>
			<h4>All Devices</h4>
			<p>Revoke all sessions and API keys across every device.</p>
		</div>
		<button type="button" class="settings-logout-all-btn" onclick={onLogoutAll} disabled={isLoggingOutEverywhere}>
			<LogOutIcon size={16} decorative={true} />
			{isLoggingOutEverywhere ? 'Logging out...' : 'Log Out of All Devices'}
		</button>
	</div>
</section>
