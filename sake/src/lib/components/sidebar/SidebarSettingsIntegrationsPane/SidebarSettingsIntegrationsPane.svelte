<script lang="ts">
	import { onMount } from 'svelte';
	import { ZUIRoutes } from '$lib/client/base/routes';
	import type { HardcoverProgressSyncStatus } from '$lib/types/Integrations/HardcoverProgress';
	import RefreshIcon from '$lib/assets/icons/RefreshIcon.svelte';
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
	let urls = $state<string[]>([]);
	let saved = $state<string[]>([]);
	let mirrorError = $state<string | null>(null);
	let mirrorNotice = $state<string | null>(null);
	let loadingMirrors = $state(true);
	let savingMirrors = $state(false);
	const changed = $derived(JSON.stringify(urls) !== JSON.stringify(saved));
	const mirrorSettingsUrl = `/api${ZUIRoutes.zlibraryMirrors}`;

	onMount(() => {
		void loadMirrors();
	});

	async function loadMirrors() {
		try {
			const response = await fetch(mirrorSettingsUrl);
			const data = (await response.json()) as { urls?: string[]; error?: string };
			if (!response.ok) throw new Error(data.error);
			urls = data.urls ?? [];
			saved = [...urls];
		} catch (cause) {
			mirrorError = cause instanceof Error ? cause.message : 'Failed to load mirrors';
		} finally {
			loadingMirrors = false;
		}
	}

	function updateUrl(index: number, value: string) {
		urls = urls.map((url, currentIndex) => (currentIndex === index ? value : url));
	}

	function moveUrl(index: number, direction: -1 | 1) {
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= urls.length) return;

		const next = [...urls];
		const current = next[index];
		const target = next[targetIndex];
		if (current === undefined || target === undefined) return;
		next[index] = target;
		next[targetIndex] = current;
		urls = next;
	}

	async function saveMirrors() {
		const next = urls.map((url) => url.trim()).filter(Boolean);
		if (!next.length) {
			mirrorError = 'Add at least one mirror URL.';
			return;
		}

		savingMirrors = true;
		mirrorNotice = null;
		try {
			const response = await fetch(mirrorSettingsUrl, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ urls: next })
			});
			const data = (await response.json()) as { urls?: string[]; error?: string };
			if (!response.ok) throw new Error(data.error);
			urls = data.urls ?? [];
			saved = [...urls];
			mirrorError = null;
			mirrorNotice = 'Mirror configuration saved.';
		} catch (cause) {
			mirrorError = cause instanceof Error ? cause.message : 'Failed to save mirrors';
		} finally {
			savingMirrors = false;
		}
	}
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

		<div class="mirror-settings">
			<div>
				<h4>Mirrors</h4>
				<p class="integration-note">Mirrors are tried in order. The first is primary.</p>
			</div>
			{#if loadingMirrors}
				<p class="integration-note">Loading mirror configuration...</p>
			{:else}
				{#each urls as url, index}
					<div class="mirror-row">
						<label class="sr-only" for={`mirror-${index}`}>Mirror {index + 1}</label>
						<input
							id={`mirror-${index}`}
							type="url"
							value={url}
							placeholder="https://mirror.example"
							disabled={savingMirrors}
							oninput={(event) => updateUrl(index, event.currentTarget.value)}
						/>
						<button
							type="button"
							disabled={index === 0 || savingMirrors}
							aria-label={`Move mirror ${index + 1} up`}
							onclick={() => moveUrl(index, -1)}>↑</button
						>
						<button
							type="button"
							disabled={index === urls.length - 1 || savingMirrors}
							aria-label={`Move mirror ${index + 1} down`}
							onclick={() => moveUrl(index, 1)}>↓</button
						>
						<button
							type="button"
							disabled={urls.length === 1 || savingMirrors}
							onclick={() => (urls = urls.filter((_, currentIndex) => currentIndex !== index))}
						>
							Remove
						</button>
					</div>
				{/each}
				{#if mirrorError}<p class="integration-error" role="alert">{mirrorError}</p>{/if}
				{#if mirrorNotice}<p class="integration-success" role="status">{mirrorNotice}</p>{/if}
				<div class="mirror-actions">
					<button type="button" disabled={savingMirrors} onclick={() => (urls = [...urls, ''])}>Add mirror</button>
					<button type="button" class="integration-sync-button" disabled={!changed || savingMirrors} onclick={saveMirrors}>
						{savingMirrors ? 'Saving...' : 'Save mirrors'}
					</button>
				</div>
			{/if}
		</div>
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
