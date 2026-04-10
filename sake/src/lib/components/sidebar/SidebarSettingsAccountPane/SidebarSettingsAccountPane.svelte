<script lang="ts">
	import SidebarApiKeyList from '../SidebarApiKeyList/SidebarApiKeyList.svelte';
	import LogOutIcon from '$lib/assets/icons/LogOutIcon.svelte';
	import RefreshIcon from '$lib/assets/icons/RefreshIcon.svelte';
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
		onSaveBasicAuthPassword: (password: string) => Promise<boolean>;
		onRemoveBasicAuthPassword: () => Promise<boolean>;
		isLoggingOut?: boolean;
		isLoggingOutEverywhere?: boolean;
		isSavingBasicAuthPassword?: boolean;
		isRemovingBasicAuthPassword?: boolean;
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
		isLoggingOutEverywhere = false,
		onSaveBasicAuthPassword,
		onRemoveBasicAuthPassword,
		isSavingBasicAuthPassword = false,
		isRemovingBasicAuthPassword = false
	}: Props = $props();

	let basicAuthPassword = $state('');
	const GENERATED_PASSWORD_LENGTH = 8;
	const GENERATED_PASSWORD_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

	async function handleSaveBasicAuthPassword(): Promise<void> {
		const saved = await onSaveBasicAuthPassword(basicAuthPassword);
		if (saved) {
			basicAuthPassword = '';
		}
	}

	async function handleRemoveBasicAuthPassword(): Promise<void> {
		const removed = await onRemoveBasicAuthPassword();
		if (removed) {
			basicAuthPassword = '';
		}
	}

	function generateBasicAuthPassword(): void {
		const randomValues = new Uint32Array(GENERATED_PASSWORD_LENGTH);
		crypto.getRandomValues(randomValues);
		basicAuthPassword = Array.from(randomValues, (value) =>
			GENERATED_PASSWORD_CHARSET[value % GENERATED_PASSWORD_CHARSET.length]
		).join('');
	}
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
		<div>
			<h4>Basic Authentication</h4>
			<p>Manage the optional password used by OPDS and WebDAV. Your normal account password will always continue to work there too.</p>
		</div>

		{#if currentUser}
			<p class="settings-basic-auth-status">
				{currentUser.hasBasicAuthPassword
					? 'A separate Basic authentication password is currently configured.'
					: 'No separate Basic authentication password is configured.'}
			</p>
		{/if}

		<div class="settings-basic-auth-form">
			<label class="settings-basic-auth-label" for="basic-auth-password">Set or replace Basic authentication password</label>
			<div class="settings-basic-auth-input-wrap">
				<input
					id="basic-auth-password"
					class="settings-basic-auth-input"
					type="text"
					bind:value={basicAuthPassword}
					placeholder="Enter a new Basic authentication password"
					autocomplete="new-password"
					disabled={isSavingBasicAuthPassword || isRemovingBasicAuthPassword}
				/>
				<button
					type="button"
					class="settings-basic-auth-generate-btn"
					onclick={generateBasicAuthPassword}
					disabled={isSavingBasicAuthPassword || isRemovingBasicAuthPassword}
					aria-label="Generate random Basic authentication password"
					title="Generate random password"
				>
					<RefreshIcon size={16} decorative={true} />
				</button>
			</div>
			<button
				type="button"
				class="settings-basic-auth-save-btn"
				onclick={handleSaveBasicAuthPassword}
				disabled={!basicAuthPassword || isSavingBasicAuthPassword || isRemovingBasicAuthPassword}
			>
				{isSavingBasicAuthPassword ? 'Saving...' : 'Save Basic Authentication Password'}
			</button>
			{#if currentUser?.hasBasicAuthPassword}
				<button
					type="button"
					class="settings-basic-auth-remove-btn"
					onclick={handleRemoveBasicAuthPassword}
					disabled={isRemovingBasicAuthPassword || isSavingBasicAuthPassword}
				>
					{isRemovingBasicAuthPassword ? 'Removing...' : 'Remove Separate Basic Authentication Password'}
				</button>
			{/if}
		</div>
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
