<script lang="ts">
	import styles from './QueueStatsGrid.module.scss';

	interface Props {
		counts: {
			queued: number;
			processing: number;
			completed: number;
			failed: number;
		};
	}

	let { counts }: Props = $props();
</script>

<section class={styles.root} aria-label="Queue stats">
	<article class={styles.card}>
		<p>In Queue</p>
		<h2 class={styles.queued}>{counts.queued}</h2>
	</article>
	<article class={styles.card}>
		<p>Processing</p>
		<h2 class={styles.processing}>{counts.processing}</h2>
	</article>
	<article class={styles.card}>
		<p>Completed</p>
		<h2 class={styles.completed}>{counts.completed}</h2>
	</article>
	<article class={styles.card}>
		<p>Failed</p>
		<h2 class={styles.failed}>{counts.failed}</h2>
	</article>
</section>
