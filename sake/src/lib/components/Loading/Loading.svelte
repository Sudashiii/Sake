<script lang="ts">
	import styles from './Loading.module.scss';

	interface Props {
		show?: boolean;
	}

	let { show = $bindable(false) }: Props = $props();
</script>

{#if show}
	<div class={styles.overlay}>
		<div class={styles.loader}>
			<div class={styles.spinner}></div>
			<span class={styles.loadingText}>Loading...</span>
		</div>
	</div>
{/if}
