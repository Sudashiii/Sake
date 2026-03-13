<script lang="ts">
	import styles from './SidebarApiKeyList.module.scss';
	import type { AuthApiKey } from '$lib/types/Auth/ApiKey';

	interface Props {
		apiKeys: AuthApiKey[];
		apiKeysError: string | null;
		isLoadingApiKeys?: boolean;
		revokingApiKeyId: number | null;
		formatDateTime: (value: string | null) => string;
		onRefresh: () => void;
		onRevoke: (apiKeyId: number, deviceId: string) => void;
	}

	let {
		apiKeys,
		apiKeysError,
		isLoadingApiKeys = false,
		revokingApiKeyId,
		formatDateTime,
		onRefresh,
		onRevoke
	}: Props = $props();
</script>

<div class={styles.root}>
	<div class="settings-account-heading-row">
		<div>
			<h4>Device API Keys</h4>
			<p>Masked keys are listed by device ID. Revoke one to force that device to pair again.</p>
		</div>
		<button type="button" class="settings-refresh-btn" onclick={onRefresh} disabled={isLoadingApiKeys || revokingApiKeyId !== null}>Refresh</button>
	</div>

	{#if apiKeysError}
		<p class="settings-error">{apiKeysError}</p>
	{:else if isLoadingApiKeys}
		<p class="settings-empty">Loading device keys...</p>
	{:else if apiKeys.length === 0}
		<p class="settings-empty">No device API keys have been issued yet.</p>
	{:else}
		<div class="api-key-list">
			{#each apiKeys as apiKey (apiKey.id)}
				<article class="api-key-card">
					<div class="api-key-card-header">
						<div class="api-key-card-copy">
							<p class="api-key-device-id">{apiKey.deviceId}</p>
							<p class="api-key-preview">{apiKey.keyPreview}</p>
						</div>
						<button type="button" class="api-key-revoke-btn" onclick={() => onRevoke(apiKey.id, apiKey.deviceId)} disabled={revokingApiKeyId !== null}>
							{revokingApiKeyId === apiKey.id ? 'Revoking...' : 'Revoke'}
						</button>
					</div>
					<div class="api-key-meta-row">
						<div>
							<p class="settings-account-meta-label">Created</p>
							<p class="api-key-meta-value">{formatDateTime(apiKey.createdAt)}</p>
						</div>
						<div>
							<p class="settings-account-meta-label">Last Used</p>
							<p class="api-key-meta-value">{formatDateTime(apiKey.lastUsedAt)}</p>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
