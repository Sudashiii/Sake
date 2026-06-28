<script lang="ts">
	import type { HardcoverProgressSyncStatus } from '$lib/types/Integrations/HardcoverProgress';
	import RefreshIcon from '$lib/assets/icons/RefreshIcon.svelte';
	import styles from './SidebarSettingsIntegrationsPane.module.scss';

	interface Props {
		status: HardcoverProgressSyncStatus | null;
		error: string | null;
		isLoading?: boolean;
		isSaving?: boolean;
		isSyncing?: boolean;
		formatDateTime: (value: string | null) => string;
		onToggle: (enabled: boolean) => void;
		onSync: () => void;
	}

	let {
		status,
		error,
		isLoading = false,
		isSaving = false,
		isSyncing = false,
		formatDateTime,
		onToggle,
		onSync
	}: Props = $props();

	const unavailableReason = $derived(
		status?.demoMode
			? 'Outbound integrations are disabled in demo mode.'
			: 'Set HARDCOVER_API_TOKEN on the server to enable progress sync.'
	);
</script>

<section class={styles.root}>
	<div class="integration-heading">
		<div>
			<h4>Hardcover</h4>
			<p>Keep Hardcover reading progress aligned with Sake.</p>
		</div>
		<label class:disabled={!status?.available || isSaving} class="integration-switch">
			<input
				type="checkbox"
				role="switch"
				checked={status?.enabled ?? false}
				disabled={!status?.available || isSaving}
				onchange={(event) => onToggle(event.currentTarget.checked)}
			/>
			<span aria-hidden="true"></span>
			<span class="sr-only">Sync reading progress to Hardcover</span>
		</label>
	</div>

	{#if isLoading && !status}
		<p class="integration-note">Loading integration status...</p>
	{:else if error}
		<p class="integration-error">{error}</p>
	{:else if status}
		{#if !status.available}
			<p class="integration-note">{unavailableReason}</p>
		{:else}
			<div class="integration-summary">
				<dl>
					<div><dt>Pending</dt><dd>{status.counts.pending + status.counts.processing}</dd></div>
					<div><dt>Failed</dt><dd>{status.counts.failed}</dd></div>
					<div><dt>Skipped</dt><dd>{status.counts.skipped}</dd></div>
				</dl>
				<p>Last successful sync: {formatDateTime(status.lastSuccessfulSyncAt)}</p>
			</div>
			<button type="button" class="integration-sync-button" disabled={!status.enabled || isSyncing} onclick={onSync}>
				<RefreshIcon size={16} decorative={true} />
				{isSyncing ? 'Queuing...' : 'Sync now'}
			</button>
		{/if}
	{/if}
</section>
