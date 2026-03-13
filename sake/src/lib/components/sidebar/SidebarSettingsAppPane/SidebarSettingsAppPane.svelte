<script lang="ts">
	import styles from './SidebarSettingsAppPane.module.scss';

	interface Props {
		appVersion: string;
		appEnvironment: string;
		appSourceUrl: string;
		appSourceLabel: string;
	}

	let { appVersion, appEnvironment, appSourceUrl, appSourceLabel }: Props = $props();
</script>

<section class={styles.root}>
	<div class="settings-pane-heading">
		<h4>Sake</h4>
		<p>Svelte and KOReader Ecosystem</p>
	</div>
	<div class="settings-pane-group settings-pane-group-roomy">
		<dl class="settings-data-list">
			<div class="settings-data-row"><dt>Version</dt><dd class="settings-mono-value">{appVersion}</dd></div>
			<div class="settings-divider"></div>
			<div class="settings-data-row"><dt>Environment</dt><dd>{appEnvironment}</dd></div>
		</dl>
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
