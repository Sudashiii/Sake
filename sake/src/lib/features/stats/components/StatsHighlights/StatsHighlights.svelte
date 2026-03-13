<script lang="ts">
	import { formatDate, formatNumber } from '$lib/features/stats/statsView';
	import type { ReadingActivityStats } from '$lib/types/Stats/ReadingActivityStats';
	import styles from './StatsHighlights.module.scss';

	interface Props {
		activity: ReadingActivityStats;
		readingBooksCount: number;
		unreadBooksCount: number;
		completedBooksCount: number;
	}

	let { activity, readingBooksCount, unreadBooksCount, completedBooksCount }: Props = $props();
</script>

<section class={styles.root} aria-label="Highlights">
	<article class={styles.card}>
		<p>Best Reading Day</p>
		<h3>{activity.totals.bestDay.pagesRead} pages</h3>
		<span>{formatDate(activity.totals.bestDay.date)}</span>
	</article>
	<article class={styles.card}>
		<p>Avg on Active Days</p>
		<h3>{activity.totals.avgPagesOnActiveDay} pages</h3>
		<span>{formatNumber(activity.totals.totalSessions)} progress snapshots</span>
	</article>
	<article class={styles.card}>
		<p>Reading Mix</p>
		<h3>{readingBooksCount} reading / {unreadBooksCount} unread</h3>
		<span>{completedBooksCount} completed</span>
	</article>
</section>
