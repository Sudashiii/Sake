<script lang="ts">
	import type { DatabaseVersionInfo } from '$lib/types/App/AppVersion';
	import { getDatabaseMigrationStatusNote } from '$lib/utils/databaseMigrationStatus';
	import styles from './SidebarSettingsAppPane.module.scss';

	interface Props {
		appVersion: string;
		databaseVersion: DatabaseVersionInfo | null;
		appVersionError: string | null;
		isLoadingAppVersion?: boolean;
		appEnvironment: string;
		appSourceUrl: string;
		appSourceLabel: string;
	}

	let {
		appVersion,
		databaseVersion,
		appVersionError,
		isLoadingAppVersion = false,
		appEnvironment,
		appSourceUrl,
		appSourceLabel
	}: Props = $props();

	function getIssueUrl(sourceUrl: string): string {
		return `${sourceUrl.replace(/\/$/, '')}/issues/new`;
	}

	function getDatabaseVersionLabel(version: DatabaseVersionInfo | null, loading: boolean): string {
		if (loading && !version) {
			return 'Checking...';
		}

		if (!version) {
			return 'Unavailable';
		}

		if (version.currentMigrationTag) {
			return version.currentMigrationTag;
		}

		if (version.status === 'untracked') {
			return 'Untracked';
		}

		if (version.status === 'unavailable') {
			return 'Unavailable';
		}

		return 'Unknown';
	}

	function getExpectedMigrationLabel(version: DatabaseVersionInfo | null, loading: boolean): string {
		if (loading && !version) {
			return 'Checking...';
		}

		return version?.expectedMigrationTag ?? 'Unavailable';
	}

	function getMigrationStatusLabel(version: DatabaseVersionInfo | null, loading: boolean): string {
		if (loading && !version) {
			return 'Checking...';
		}

		switch (version?.status) {
			case 'up_to_date':
				return 'Up to date';
			case 'outdated':
				return 'Migration required';
			case 'untracked':
				return 'Untracked';
			case 'unavailable':
				return 'Unavailable';
			default:
				return 'Unavailable';
		}
	}

	const statusNote = $derived(
		getDatabaseMigrationStatusNote(databaseVersion, appVersionError, isLoadingAppVersion)
	);
</script>

<section class={styles.root}>
	<div class="settings-pane-heading">
		<h4>Sake</h4>
		<p>Svelte and KOReader Ecosystem</p>
		<div class="settings-app-actions">
			<a href={appSourceUrl} target="_blank" rel="noopener noreferrer" class="settings-app-link-btn">
				Open GitHub
			</a>
			<a href={getIssueUrl(appSourceUrl)} target="_blank" rel="noopener noreferrer" class="settings-app-link-btn settings-app-link-btn-accent">
				Report a Bug
			</a>
		</div>
	</div>
	<div class="settings-pane-group settings-pane-group-roomy">
		<dl class="settings-data-list">
			<div class="settings-data-row"><dt>Version</dt><dd class="settings-mono-value">{appVersion}</dd></div>
			<div class="settings-divider"></div>
			<div class="settings-data-row">
				<dt>Database Version</dt>
				<dd class="settings-mono-value">{getDatabaseVersionLabel(databaseVersion, isLoadingAppVersion)}</dd>
			</div>
			<div class="settings-divider"></div>
			<div class="settings-data-row">
				<dt>Expected DB Version</dt>
				<dd class="settings-mono-value">{getExpectedMigrationLabel(databaseVersion, isLoadingAppVersion)}</dd>
			</div>
			<div class="settings-divider"></div>
			<div class="settings-data-row">
				<dt>Migration Status</dt>
				<dd>{getMigrationStatusLabel(databaseVersion, isLoadingAppVersion)}</dd>
			</div>
			<div class="settings-divider"></div>
			<div class="settings-data-row"><dt>Environment</dt><dd>{appEnvironment}</dd></div>
		</dl>
		{#if statusNote}
			<p class="settings-status-note">{statusNote}</p>
		{/if}
	</div>
	<div class="settings-about-card">
		<p class="settings-about-title">About</p>
		<p>Sake is a self-hosted book management platform designed to work seamlessly with KOReader and Z-Library. It provides a unified interface for searching, downloading, organizing, and syncing your digital book collection across all your e-readers and devices.</p>
		<p>Built with privacy in mind — all data stays on your server. No telemetry, no tracking, fully open source.</p>
	</div>
	<div class="settings-pane-group settings-pane-group-compact">
		<dl class="settings-data-list">
			<div class="settings-data-row"><dt>License</dt><dd>AGPL-3.0-only</dd></div>
			<div class="settings-divider"></div>
			<div class="settings-data-row">
				<dt>Source</dt>
				<dd><a href={appSourceUrl} target="_blank" rel="noopener noreferrer" class="settings-source-link">{appSourceLabel}</a></dd>
			</div>
		</dl>
	</div>
</section>
