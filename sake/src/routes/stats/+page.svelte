<script lang="ts">
	import { onMount } from 'svelte';
	import Loading from '$lib/components/Loading/Loading.svelte';
	import SectionErrorBanner from '$lib/components/SectionErrorBanner/SectionErrorBanner.svelte';
	import { ZUI } from '$lib/client/zui';
	import StatsHighlights from '$lib/features/stats/components/StatsHighlights/StatsHighlights.svelte';
	import StatsSummaryGrid from '$lib/features/stats/components/StatsSummaryGrid/StatsSummaryGrid.svelte';
	import ReadingActivityHeatmap from '$lib/features/stats/components/ReadingActivityHeatmap/ReadingActivityHeatmap.svelte';
	import PagesPerDayChart from '$lib/features/stats/components/PagesPerDayChart/PagesPerDayChart.svelte';
	import WeeklyTrendChart from '$lib/features/stats/components/WeeklyTrendChart/WeeklyTrendChart.svelte';
	import ReadingTimeOfDayChart from '$lib/features/stats/components/ReadingTimeOfDayChart/ReadingTimeOfDayChart.svelte';
	import MonthlyOverviewCard from '$lib/features/stats/components/MonthlyOverviewCard/MonthlyOverviewCard.svelte';
	import FormatDistributionCard from '$lib/features/stats/components/FormatDistributionCard/FormatDistributionCard.svelte';
	import RatingDistributionCard from '$lib/features/stats/components/RatingDistributionCard/RatingDistributionCard.svelte';
	import StatusDistributionCard from '$lib/features/stats/components/StatusDistributionCard/StatusDistributionCard.svelte';
	import ReadingStreaksCard from '$lib/features/stats/components/ReadingStreaksCard/ReadingStreaksCard.svelte';
	import {
		DAILY_RANGES,
		buildStatsViewModel,
		type DailyRange
	} from '$lib/features/stats/statsView';
	import type { ApiError } from '$lib/types/ApiError';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import type { ReadingActivityStats } from '$lib/types/Stats/ReadingActivityStats';
	import styles from './page.module.scss';

	let isLoading = $state(true);
	let error = $state<ApiError | null>(null);
	let books = $state<LibraryBook[]>([]);
	let activity = $state<ReadingActivityStats | null>(null);
	let dailyRange = $state<DailyRange>(30);

	const view = $derived.by(() => buildStatsViewModel(books, activity, dailyRange));

	onMount(() => {
		void loadStats();
	});

	async function loadStats(): Promise<void> {
		isLoading = true;
		error = null;

		const [libraryResult, activityResult] = await Promise.all([
			ZUI.getLibrary(),
			ZUI.getReadingActivityStats(365)
		]);

		if (!libraryResult.ok) {
			error = libraryResult.error;
			isLoading = false;
			return;
		}

		if (!activityResult.ok) {
			error = activityResult.error;
			isLoading = false;
			return;
		}

		books = libraryResult.value.books;
		activity = activityResult.value;
		isLoading = false;
	}
</script>

<div class={styles.root}>
	<Loading bind:show={isLoading} />

	{#if error}
		<SectionErrorBanner message={error.message} onRetry={loadStats} />
	{/if}

	{#if activity}
		<StatsSummaryGrid
			activity={activity}
			completedBooksCount={view.completedBooksCount}
			booksCount={books.length}
			readingPercentage={view.readingPercentage}
		/>

		<StatsHighlights
			activity={activity}
			readingBooksCount={view.readingBooksCount}
			unreadBooksCount={view.unreadBooksCount}
			completedBooksCount={view.completedBooksCount}
		/>

		<ReadingActivityHeatmap heatmap={view.heatmap} totalPages={activity.totals.totalPages} />

		<PagesPerDayChart
			dailyRange={dailyRange}
			dailyRanges={DAILY_RANGES}
			recentDaily={view.recentDaily}
			maxDailyPages={view.maxDailyPages}
			onRangeChange={(range) => (dailyRange = range)}
		/>

		<section class={styles.splitGrid}>
			<WeeklyTrendChart recentWeekly={view.recentWeekly} maxWeeklyPages={view.maxWeeklyPages} />
			<ReadingTimeOfDayChart hourly={activity.hourly} maxHourlyPages={view.maxHourlyPages} />
		</section>

		<section class={`${styles.splitGrid} ${styles.monthlyGrid}`}>
			<MonthlyOverviewCard recentMonthly={view.recentMonthly} maxMonthlyPages={view.maxMonthlyPages} />
			<div class={styles.distributionStack}>
				<FormatDistributionCard booksByFormat={view.booksByFormat} formatPieGradient={view.formatPieGradient} />
				<RatingDistributionCard ratingDistribution={view.ratingDistribution} maxRatingCount={view.maxRatingCount} />
				<StatusDistributionCard booksByStatus={view.booksByStatus} totalBooks={books.length} maxStatusCount={view.maxStatusCount} />
			</div>
		</section>

		<ReadingStreaksCard streak={activity.streak} streakPreviewCells={view.streakPreviewCells} />
	{/if}
</div>
