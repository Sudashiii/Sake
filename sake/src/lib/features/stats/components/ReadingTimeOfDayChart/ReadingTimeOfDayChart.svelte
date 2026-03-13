<script lang="ts">
	import type { ReadingActivityHour } from '$lib/types/Stats/ReadingActivityStats';
	import styles from './ReadingTimeOfDayChart.module.scss';

	interface Props {
		hourly: ReadingActivityHour[];
		maxHourlyPages: number;
	}

	let { hourly, maxHourlyPages }: Props = $props();
</script>

<article class={styles.card}>
	<div class={styles.cardHead}>
		<h3>Reading by Time of Day</h3>
	</div>
	<div class={styles.barChart}>
		{#each hourly as item}
			<div class={styles.barCol} data-tooltip={`${item.label}: ${item.pages} page${item.pages === 1 ? '' : 's'}`}>
				<div class={styles.barTrack}>
					<div class={`${styles.barFill} ${styles.blue}`} style={`height: ${(item.pages / maxHourlyPages) * 100}%`}></div>
				</div>
				<span>{item.label}</span>
			</div>
		{/each}
	</div>
</article>
