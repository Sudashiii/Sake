<script lang="ts">
	import type { ReadingActivityWeek } from '$lib/types/Stats/ReadingActivityStats';
	import styles from './WeeklyTrendChart.module.scss';

	interface Props {
		recentWeekly: ReadingActivityWeek[];
		maxWeeklyPages: number;
	}

	let { recentWeekly, maxWeeklyPages }: Props = $props();
</script>

<article class={styles.card}>
	<div class={styles.cardHead}>
		<h3>Weekly Trend</h3>
	</div>
	<div class={styles.barChart}>
		{#each recentWeekly as item}
			<div class={styles.barCol} data-tooltip={`${item.week}: ${item.pages} page${item.pages === 1 ? '' : 's'}`}>
				<div class={styles.barTrack}>
					<div class={`${styles.barFill} ${styles.goldSoft}`} style={`height: ${(item.pages / maxWeeklyPages) * 100}%`}></div>
				</div>
				<span>{item.week}</span>
			</div>
		{/each}
	</div>
</article>
