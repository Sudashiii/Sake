<script lang="ts">
	import { ZUIRoutes } from '$lib/client/base/routes';
	import type { HardcoverProgressSyncStatus } from '$lib/types/Integrations/HardcoverProgress';
	import RefreshIcon from '$lib/assets/icons/RefreshIcon.svelte';
	import MirrorSettings from '../MirrorSettings/MirrorSettings.svelte';
	import styles from './SidebarSettingsIntegrationsPane.module.scss';

	interface Props {
		status: HardcoverProgressSyncStatus | null;
		error: string | null;
		zlibName: string;
		showZLibraryLogin: boolean;
		isLoggingOutZLibrary?: boolean;
		onOpenZLibraryLogin: () => void;
		onLogoutZLibrary: () => void;
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
		zlibName,
		showZLibraryLogin,
		isLoggingOutZLibrary = false,
		onOpenZLibraryLogin,
		onLogoutZLibrary,
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
	<div class="zlibrary-group" aria-labelledby="zlibrary-integration-title">
		<div class="integration-group-header">
			<h3 id="zlibrary-integration-title">Z-Library</h3>
			<p>Manage account access and the mirror order used for provider requests.</p>
		</div>

		{#if showZLibraryLogin}
			<div class="zlibrary-settings">
				<div>
					<h4>Account</h4>
					<p class="integration-note">Connect an account or remix credentials for authenticated search and downloads.</p>
				</div>
				<div class="zlibrary-account-row">
					<div>
						<p class="zlibrary-account-status">{zlibName ? 'Connected' : 'Not connected'}</p>
						{#if zlibName}<p class="zlibrary-account-identity">{zlibName}</p>{/if}
					</div>
					<button
						type="button"
						class="zlibrary-account-action"
						class:disconnect={Boolean(zlibName)}
						disabled={isLoggingOutZLibrary}
						onclick={zlibName ? onLogoutZLibrary : onOpenZLibraryLogin}
					>
						{zlibName ? (isLoggingOutZLibrary ? 'Logging out...' : 'Log out') : 'Connect'}
					</button>
				</div>
			</div>
		{/if}

		<MirrorSettings
			settingsUrl={`/api${ZUIRoutes.zlibraryMirrors}`}
			inputIdPrefix="zlibrary-mirror"
			note="Mirrors are tried in order. The first is primary. Use HTTPS URLs; up to 5 mirrors are supported."
		/>
	</div>

	<div class="anna-group" aria-labelledby="anna-integration-title">
		<div class="integration-group-header">
			<h3 id="anna-integration-title">Anna's Archive</h3>
			<p>Configure the ordered endpoints used for server-side Anna search requests.</p>
		</div>
		<MirrorSettings
			settingsUrl={`/api${ZUIRoutes.annaArchiveMirrors}`}
			inputIdPrefix="anna-archive-mirror"
			note="Mirrors are tried in order, with up to 5 HTTPS endpoints. Use an Anna-compatible mirror or proxy that preserves the legacy /search HTML and /md5 links."
			placeholder="https://annas-archive.example"
		/>
	</div>

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
