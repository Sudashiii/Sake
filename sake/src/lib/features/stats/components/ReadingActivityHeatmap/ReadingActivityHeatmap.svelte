<script lang="ts">
	import { formatDate, formatNumber, getHeatColor, type HeatmapData } from '$lib/features/stats/statsView';
	import styles from './ReadingActivityHeatmap.module.scss';

	interface Props {
		heatmap: HeatmapData;
		totalPages: number;
	}

	let { heatmap, totalPages }: Props = $props();
</script>

<section class={styles.card}>
	<div class={styles.cardHead}>
		<h3>Reading Activity</h3>
		<p>{formatNumber(totalPages)} pages in the last year</p>
	</div>

	{#if heatmap.weeks.length > 0}
		<div class={styles.shell}>
			<div class={styles.scroll}>
				<div class={styles.inner} style={`--heatmap-weeks: ${heatmap.weeks.length}`}>
					<div class={styles.monthLabels}>
						{#each heatmap.monthLabels as label}
							<span style={`left: ${label.col * 16}px`}>{label.label}</span>
						{/each}
					</div>

					<div class={styles.gridWrap}>
						<div class={styles.dayLabels}>
							<span>Mon</span>
							<span></span>
							<span>Wed</span>
							<span></span>
							<span>Fri</span>
							<span></span>
							<span>Sun</span>
						</div>
						<div class={styles.weeks}>
							{#each heatmap.weeks as week}
								<div class={styles.week}>
									{#each week as cell}
										{#if cell}
											<button
												type="button"
												class={styles.cell}
												style={`background: ${getHeatColor(cell.pagesRead, heatmap.maxPages)}`}
												data-tooltip={`${formatDate(cell.date)}: ${cell.pagesRead} page${cell.pagesRead === 1 ? '' : 's'}`}
												aria-label={`${formatDate(cell.date)}: ${cell.pagesRead} page${cell.pagesRead === 1 ? '' : 's'}`}
											></button>
										{:else}
											<div class={`${styles.cell} ${styles.empty}`}></div>
										{/if}
									{/each}
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div class={styles.legend}>
				<span>Less</span>
				{#each [0, 0.15, 0.3, 0.5, 0.7, 1] as ratio}
					<div style={`background: ${ratio === 0 ? '#1e2230' : getHeatColor(heatmap.maxPages * ratio, heatmap.maxPages)}`}></div>
				{/each}
				<span>More</span>
			</div>
		</div>
	{/if}
</section>
