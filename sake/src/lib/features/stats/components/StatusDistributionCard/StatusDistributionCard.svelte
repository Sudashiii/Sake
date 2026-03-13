<script lang="ts">
	import { STATUS_COLORS, type BookStatus } from '$lib/features/stats/statsView';
	import styles from './StatusDistributionCard.module.scss';

	interface Props {
		booksByStatus: Array<{ name: BookStatus; value: number }>;
		totalBooks: number;
		maxStatusCount: number;
	}

	let { booksByStatus, totalBooks, maxStatusCount }: Props = $props();
</script>

<article class={styles.card}>
	<div class={styles.cardHead}><h3>Books by Status</h3></div>
	<div class={styles.rows}>
		{#each booksByStatus as status}
			{@const pct = totalBooks > 0 ? Math.round((status.value / totalBooks) * 100) : 0}
			<div class={styles.row}>
				<div class={styles.head}>
					<span>{status.name}</span>
					<em>{status.value} ({pct}%)</em>
				</div>
				<div class={styles.track}>
					<div class={styles.fill} style={`width: ${(status.value / maxStatusCount) * 100}%; background: ${STATUS_COLORS[status.name]}`}></div>
				</div>
			</div>
		{/each}
	</div>
</article>
