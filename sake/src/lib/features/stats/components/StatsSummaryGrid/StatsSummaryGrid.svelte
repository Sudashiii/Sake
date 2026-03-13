<script lang="ts">
	import { formatNumber } from '$lib/features/stats/statsView';
	import type { ReadingActivityStats } from '$lib/types/Stats/ReadingActivityStats';
	import styles from './StatsSummaryGrid.module.scss';

	interface Props {
		activity: ReadingActivityStats;
		completedBooksCount: number;
		booksCount: number;
		readingPercentage: number;
	}

	let { activity, completedBooksCount, booksCount, readingPercentage }: Props = $props();
</script>

<section class={styles.root} aria-label="Summary stats">
	<article class={styles.card}>
		<p>Total Pages Read</p>
		<h2>{formatNumber(activity.totals.totalPages)}</h2>
		<span>{activity.totals.avgPagesPerDay} avg/day</span>
	</article>
	<article class={styles.card}>
		<p>Current Streak</p>
		<h2 class={styles.accentRed}>{activity.streak.current} days</h2>
		<span>Longest: {activity.streak.longest} days</span>
	</article>
	<article class={styles.card}>
		<p>Days Active</p>
		<h2 class={styles.accentGreen}>{activity.totals.daysActive}</h2>
		<span>{readingPercentage}% of days</span>
	</article>
	<article class={styles.card}>
		<p>Books Completed</p>
		<h2 class={styles.accentBlue}>{completedBooksCount}</h2>
		<span>{booksCount} books in library</span>
	</article>
</section>
