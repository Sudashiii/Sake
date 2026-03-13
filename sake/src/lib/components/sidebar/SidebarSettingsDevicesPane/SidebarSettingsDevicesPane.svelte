<script lang="ts">
	import RefreshIcon from '$lib/assets/icons/RefreshIcon.svelte';
	import Trash2Icon from '$lib/assets/icons/Trash2Icon.svelte';
	import styles from './SidebarSettingsDevicesPane.module.scss';
	import type { RegisteredDevice } from '$lib/types/Auth/Device';

	interface Props {
		devices: RegisteredDevice[];
		devicesError: string | null;
		isLoadingDevices?: boolean;
		deletingDeviceId: string | null;
		formatDateTime: (value: string | null) => string;
		onRefresh: () => void;
		onDelete: (deviceId: string) => void;
	}

	let {
		devices,
		devicesError,
		isLoadingDevices = false,
		deletingDeviceId,
		formatDateTime,
		onRefresh,
		onDelete
	}: Props = $props();
</script>

<section class={styles.root}>
	<div class="settings-devices-header">
		<div>
			<h4>Devices</h4>
			<p>Manage devices that have connected to this Sake account.</p>
		</div>
		<button type="button" class="settings-devices-refresh-btn" onclick={onRefresh} disabled={isLoadingDevices || deletingDeviceId !== null}>
			<RefreshIcon size={16} decorative={true} />
			Refresh
		</button>
	</div>

	{#if devicesError}
		<p class="settings-error">{devicesError}</p>
	{:else if isLoadingDevices}
		<p class="settings-empty">Loading devices...</p>
	{:else if devices.length === 0}
		<p class="settings-empty">No devices have reported themselves yet.</p>
	{:else}
		<div class="settings-device-list">
			{#each devices as device (device.deviceId)}
				<article class="settings-device-card">
					<div class="settings-device-top">
						<div class="settings-device-heading">
							<p class="settings-device-name">{device.deviceId}</p>
							<div class="settings-device-badges">
								<span class={`settings-device-badge ${device.hasActiveApiKey ? 'active' : ''}`}>
									{device.hasActiveApiKey ? 'API key active' : 'No active API key'}
								</span>
							</div>
						</div>
						<button
							type="button"
							class="settings-device-delete-btn"
							onclick={() => onDelete(device.deviceId)}
							disabled={deletingDeviceId !== null}
						>
							<Trash2Icon size={16} decorative={true} />
							{deletingDeviceId === device.deviceId ? 'Deleting...' : 'Delete'}
						</button>
					</div>

					<dl class="settings-device-meta">
						<div class="settings-device-meta-row">
							<dt>Plugin Version</dt>
							<dd>{device.pluginVersion}</dd>
						</div>
						<div class="settings-device-meta-row">
							<dt>Last Seen</dt>
							<dd>{formatDateTime(device.lastSeenAt)}</dd>
						</div>
						<div class="settings-device-meta-row">
							<dt>Added</dt>
							<dd>{formatDateTime(device.createdAt)}</dd>
						</div>
					</dl>
				</article>
			{/each}
		</div>
	{/if}
</section>
