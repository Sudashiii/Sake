<script lang="ts">
	import { formatDate, type DailyChartEntry, type DailyRange } from '$lib/features/stats/statsView';
	import styles from './PagesPerDayChart.module.scss';

	interface Props {
		dailyRange: DailyRange;
		dailyRanges: DailyRange[];
		recentDaily: DailyChartEntry[];
		maxDailyPages: number;
		onRangeChange: (range: DailyRange) => void;
	}

	let { dailyRange, dailyRanges, recentDaily, maxDailyPages, onRangeChange }: Props = $props();
</script>

<section class={styles.card}>
	<div class={styles.cardHead}>
		<h3>Pages Per Day</h3>
		<div class={styles.rangeSwitch}>
			{#each dailyRanges as range}
				<button type="button" class:active={dailyRange === range} onclick={() => onRangeChange(range)}>
					{range}d
				</button>
			{/each}
		</div>
	</div>

	<div class={styles.barChart} class:compact={dailyRange === 30}>
		{#each recentDaily as item}
			<div class={styles.barCol} data-tooltip={`${formatDate(item.date)}: ${item.pagesRead} page${item.pagesRead === 1 ? '' : 's'}`}>
				<div class={styles.barTrack}>
					<div class={`${styles.barFill} ${styles.gold}`} style={`height: ${(item.pagesRead / maxDailyPages) * 100}%`}></div>
				</div>
				<span>{item.label}</span>
			</div>
		{/each}
	</div>
</section>
