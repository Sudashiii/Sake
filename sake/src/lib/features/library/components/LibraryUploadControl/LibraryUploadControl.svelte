<script lang="ts">
	import UploadIcon from '$lib/assets/icons/UploadIcon.svelte';
	import styles from './LibraryUploadControl.module.scss';

	interface Props {
		isUploading?: boolean;
		onChange: (event: Event) => void;
	}

	let { isUploading = false, onChange }: Props = $props();
	let inputEl = $state<HTMLInputElement | null>(null);

	function openPicker(): void {
		inputEl?.click();
	}
</script>

<div class={styles.root}>
	<button type="button" class="import-btn" onclick={openPicker} disabled={isUploading}>
		<UploadIcon size={17} decorative={true} />
		<span>{isUploading ? 'Importing...' : 'Import'}</span>
	</button>
	<input class="upload-input" type="file" bind:this={inputEl} onchange={onChange} />
</div>
