<script lang="ts">
	import { formatDate } from '$lib/features/stats/statsView';
	import type { ReadingActivityStreak } from '$lib/types/Stats/ReadingActivityStats';
	import styles from './ReadingStreaksCard.module.scss';

	interface Props {
		streak: ReadingActivityStreak;
		streakPreviewCells: number[];
	}

	let { streak, streakPreviewCells }: Props = $props();
</script>

<section class={styles.card}>
	<div class={styles.cardHead}><h3>Reading Streaks</h3></div>
	<div class={styles.grid}>
		<div class={styles.box}>
			<p>Current Streak</p>
			<div class={styles.main}><strong>{streak.current}</strong><span>days</span></div>
			<div class={styles.cells}>
				{#each streakPreviewCells as cell}
					<div style={`opacity: ${0.3 + (cell / Math.max(streakPreviewCells.length, 1)) * 0.7}`}></div>
				{/each}
				{#if streak.current > 14}
					<em>+{streak.current - 14}</em>
				{/if}
			</div>
		</div>
		<div class={styles.box}>
			<p>Longest Streak</p>
			<div class={styles.main}><strong>{streak.longest}</strong><span>days</span></div>
			<div class={styles.range}>
				{#if streak.longestStart && streak.longestEnd}
					{formatDate(streak.longestStart)} — {formatDate(streak.longestEnd)}
				{:else}
					—
				{/if}
			</div>
		</div>
	</div>
</section>
