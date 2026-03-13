<script lang="ts">
	import { toastStore } from '$lib/client/stores/toastStore.svelte';
	import Toast from '$lib/components/Toast/Toast.svelte';
	import styles from './ToastContainer.module.scss';
</script>

<div class={styles.container}>
	{#each toastStore.toasts as toast (toast.id)}
		<Toast {toast} />
	{/each}
</div>
