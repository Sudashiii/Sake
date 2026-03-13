<script lang="ts">
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import CheckCircleIcon from '$lib/assets/icons/CheckCircleIcon.svelte';
	import XCircleIcon from '$lib/assets/icons/XCircleIcon.svelte';
	import XIcon from '$lib/assets/icons/XIcon.svelte';
	import type { Toast } from '$lib/client/stores/toastStore.svelte';
	import { toastStore } from '$lib/client/stores/toastStore.svelte';
	import { fade, fly } from 'svelte/transition';
	import styles from './Toast.module.scss';

	interface Props {
		toast: Toast;
	}

	const { toast }: Props = $props();

	function dismiss() {
		toastStore.remove(toast.id);
	}
</script>

<div
	class={`${styles.toast} ${styles[toast.type]}`}
	in:fly={{ y: 20, duration: 300 }}
	out:fade={{ duration: 200 }}
	role="alert"
>
	<div class={styles.icon}>
		{#if toast.type === 'success'}
			<CheckCircleIcon size={20} />
		{:else if toast.type === 'error'}
			<XCircleIcon size={20} />
		{:else}
			<AlertCircleIcon size={20} />
		{/if}
	</div>
	<span class={styles.message}>{toast.message}</span>
	<button class={styles.closeButton} onclick={dismiss} aria-label="Close">
		<XIcon size={16} strokeWidth={2} />
	</button>
</div>
