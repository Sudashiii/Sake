<script lang="ts">
	import DownloadIcon from '$lib/assets/icons/DownloadIcon.svelte';
	import RefreshIcon from '$lib/assets/icons/RefreshIcon.svelte';
	import type {
		KoreaderPluginRelease,
		KoreaderPluginReleasesResponse,
		KoreaderPluginUpstreamVersionResponse,
		KoreaderPluginUpstreamStatus
	} from '$lib/types/Plugin/KoreaderPlugin';
	import styles from './SidebarSettingsPluginPane.module.scss';

	interface Props {
		releasesInfo: KoreaderPluginReleasesResponse | null;
		releasesError: string | null;
		isLoadingPluginReleases?: boolean;
		upstreamVersionInfo: KoreaderPluginUpstreamVersionResponse | null;
		upstreamVersionError: string | null;
		isCheckingPluginUpstreamVersion?: boolean;
		formatDateTime: (value: string | null) => string;
		onRefresh: () => void;
		onCheckUpstream: () => void;
	}

	let {
		releasesInfo,
		releasesError,
		isLoadingPluginReleases = false,
		upstreamVersionInfo,
		upstreamVersionError,
		isCheckingPluginUpstreamVersion = false,
		formatDateTime,
		onRefresh,
		onCheckUpstream
	}: Props = $props();

	const releases = $derived(releasesInfo?.releases ?? []);
	const latestRelease = $derived(
		releases.find((release) => release.isLatest) ?? releases[0] ?? null
	);

	function formatSha(value: string): string {
		if (value.length <= 18) {
			return value;
		}

		return `${value.slice(0, 10)}...${value.slice(-6)}`;
	}

	function getStatusLabel(status: KoreaderPluginUpstreamStatus): string {
		switch (status) {
			case 'up_to_date':
				return 'Up to date';
			case 'outdated':
				return 'Update available';
			case 'uploaded_newer':
				return 'Uploaded newer than GitHub';
			case 'unavailable':
				return 'Unable to compare';
		}
	}

	function getStatusDetail(info: KoreaderPluginUpstreamVersionResponse): string {
		if (!info.upstreamVersion) {
			return 'GitHub metadata could not be read.';
		}

		if (!info.uploadedVersion) {
			return `GitHub reports ${info.upstreamVersion}, but no uploaded release is available.`;
		}

		return `Uploaded ${info.uploadedVersion}, GitHub ${info.upstreamVersion}.`;
	}

	function getReleaseLabel(release: KoreaderPluginRelease): string {
		return release.isLatest ? `${release.version} latest` : release.version;
	}
</script>

<section class={styles.root}>
	<div class="settings-plugin-header">
		<div>
			<h4>Plugin</h4>
			<p>Download the KOReader Sake plugin artifacts uploaded by this server.</p>
		</div>
		<button type="button" class="settings-plugin-refresh-btn" onclick={onRefresh} disabled={isLoadingPluginReleases}>
			<RefreshIcon size={16} decorative={true} />
			Refresh
		</button>
	</div>

	{#if releasesError}
		<p class="settings-error">{releasesError}</p>
	{:else if isLoadingPluginReleases && releases.length === 0}
		<p class="settings-empty">Loading plugin releases...</p>
	{:else if releases.length === 0}
		<p class="settings-empty">No uploaded plugin releases are available yet.</p>
	{:else}
		{#if latestRelease}
			<article class="settings-plugin-latest">
				<div class="settings-plugin-latest-copy">
					<p class="settings-plugin-label">Latest uploaded</p>
					<h5>{latestRelease.version}</h5>
					<dl class="settings-plugin-meta">
						<div>
							<dt>Updated</dt>
							<dd>{formatDateTime(latestRelease.updatedAt)}</dd>
						</div>
						<div>
							<dt>SHA-256</dt>
							<dd class="settings-plugin-sha">{formatSha(latestRelease.sha256)}</dd>
						</div>
					</dl>
				</div>
				<a href={latestRelease.downloadUrl} download={latestRelease.fileName} class="settings-plugin-download-primary">
					<DownloadIcon size={16} decorative={true} />
					Download
				</a>
			</article>
		{/if}

		<div class="settings-plugin-upstream">
			<div>
				<p class="settings-plugin-upstream-title">GitHub version check</p>
				{#if upstreamVersionError}
					<p class="settings-error">{upstreamVersionError}</p>
				{:else if upstreamVersionInfo}
					<p class={`settings-plugin-status ${upstreamVersionInfo.status}`}>
						{getStatusLabel(upstreamVersionInfo.status)}
					</p>
					<p class="settings-plugin-status-detail">
						{getStatusDetail(upstreamVersionInfo)}
					</p>
				{:else}
					<p class="settings-plugin-status-detail">Manual check only. Opening settings does not contact GitHub.</p>
				{/if}
			</div>
			<button
				type="button"
				class="settings-plugin-check-btn"
				onclick={onCheckUpstream}
				disabled={isCheckingPluginUpstreamVersion}
			>
				<RefreshIcon size={16} decorative={true} />
				{isCheckingPluginUpstreamVersion ? 'Checking...' : 'Check upstream'}
			</button>
		</div>

		<div class="settings-plugin-history">
			<div class="settings-plugin-history-heading">
				<h5>Uploaded versions</h5>
				<span>{releases.length}</span>
			</div>
			<div class="settings-plugin-release-list">
				{#each releases as release (release.version)}
					<article class="settings-plugin-release-row">
						<div>
							<p class="settings-plugin-release-version">{getReleaseLabel(release)}</p>
							<p class="settings-plugin-release-meta">
								{formatDateTime(release.updatedAt)} - {formatSha(release.sha256)}
							</p>
						</div>
						<a href={release.downloadUrl} download={release.fileName} class="settings-plugin-download-secondary" aria-label={`Download plugin version ${release.version}`}>
							<DownloadIcon size={16} decorative={true} />
							Download
						</a>
					</article>
				{/each}
			</div>
		</div>
	{/if}
</section>
