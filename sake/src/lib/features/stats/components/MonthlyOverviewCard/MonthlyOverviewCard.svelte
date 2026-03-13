<script lang="ts">
	import { formatNumber } from '$lib/features/stats/statsView';
	import type { ReadingActivityMonth } from '$lib/types/Stats/ReadingActivityStats';
	import styles from './MonthlyOverviewCard.module.scss';

	interface Props {
		recentMonthly: ReadingActivityMonth[];
		maxMonthlyPages: number;
	}

	let { recentMonthly, maxMonthlyPages }: Props = $props();
</script>

<article class={styles.card}>
	<div class={styles.cardHead}>
		<h3>Monthly Overview</h3>
	</div>
	<div class={styles.monthlyBars}>
		{#each recentMonthly as month}
			<div
				class={styles.monthlyRow}
				data-tooltip={`${month.month}: ${month.pages} page${month.pages === 1 ? '' : 's'}, ${month.booksFinished} book${month.booksFinished === 1 ? '' : 's'} finished`}
			>
				<div class={styles.monthLabel}>{month.month}</div>
				<div class={styles.monthTrack}>
					<div class={styles.monthFill} style={`width: ${(month.pages / maxMonthlyPages) * 100}%`}></div>
				</div>
				<div class={styles.monthValues}>
					<span>{formatNumber(month.pages)}</span>
					<em>{month.booksFinished}</em>
				</div>
			</div>
		{/each}
	</div>

	<div class={styles.tableWrap}>
		<table>
			<thead>
				<tr>
					<th>Month</th>
					<th>Pages</th>
					<th>Avg/Day</th>
					<th>Books Done</th>
				</tr>
			</thead>
			<tbody>
				{#each [...recentMonthly].slice(-6).reverse() as month}
					<tr>
						<td>{month.month}</td>
						<td>{formatNumber(month.pages)}</td>
						<td>{month.avgPagesPerDay}</td>
						<td>{month.booksFinished > 0 ? month.booksFinished : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</article>
