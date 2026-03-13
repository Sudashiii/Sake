<script lang="ts">
	import SmartphoneIcon from '$lib/assets/icons/SmartphoneIcon.svelte';
	import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
	import styles from './LibraryDetailDevicesTab.module.scss';

	interface Props {
		selectedBookDetail: LibraryBookDetail;
		removingDeviceId: string | null;
		onRemoveDeviceDownload: (deviceId: string) => void;
	}

	let { selectedBookDetail, removingDeviceId, onRemoveDeviceDownload }: Props = $props();
</script>

<div class={styles.root}>
	<div class="detail-v2-devices-head">
		<h3>Downloaded Devices</h3>
		<span>{selectedBookDetail.downloadedDevices.length} device{selectedBookDetail.downloadedDevices.length !== 1 ? 's' : ''}</span>
	</div>
	{#if selectedBookDetail.downloadedDevices.length === 0}
		<p class="detail-muted">No device downloads tracked.</p>
	{:else}
		<div class="detail-v2-device-list">
			{#each selectedBookDetail.downloadedDevices as device}
				<div class="detail-v2-device-row">
					<div class="detail-v2-device-icon">
						<SmartphoneIcon size={15} decorative={true} />
					</div>
					<div class="detail-v2-device-text">
						<p>{device}</p>
						<span>Downloaded device</span>
					</div>
					<button type="button" class="detail-v2-device-remove" onclick={() => onRemoveDeviceDownload(device)} disabled={removingDeviceId !== null}>
						{removingDeviceId === device ? 'Removing...' : 'Remove'}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
