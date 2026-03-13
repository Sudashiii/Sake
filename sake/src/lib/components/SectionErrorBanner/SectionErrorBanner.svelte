<script lang="ts">
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import styles from './SectionErrorBanner.module.scss';

	interface Props {
		message: string;
		onRetry: () => void;
	}

	let { message, onRetry }: Props = $props();
</script>

<div class={styles.root}>
	<AlertCircleIcon size={18} decorative={true} />
	<p>{message}</p>
	<button type="button" onclick={onRetry}>Retry</button>
</div>
