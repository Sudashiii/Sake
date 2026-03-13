<script lang="ts">
	import { onMount } from 'svelte';
	import { ZUI } from '$lib/client/zui';
	import Loading from '$lib/components/Loading/Loading.svelte';
	import SectionErrorBanner from '$lib/components/SectionErrorBanner/SectionErrorBanner.svelte';
	import QueueEmptyState from '$lib/features/queue/QueueEmptyState/QueueEmptyState.svelte';
	import QueueJobCard from '$lib/features/queue/QueueJobCard/QueueJobCard.svelte';
	import QueueStatsGrid from '$lib/features/queue/QueueStatsGrid/QueueStatsGrid.svelte';
	import QueueTabs from '$lib/features/queue/QueueTabs/QueueTabs.svelte';
	import { buildQueueCounts, filterQueueJobs, type QueueJob, type QueueTab } from '$lib/features/queue/queueView';
	import type { ApiError } from '$lib/types/ApiError';
	import styles from './page.module.scss';

	let isLoading = $state(true);
	let error = $state<ApiError | null>(null);
	let queueJobs = $state<QueueJob[]>([]);
	let activeTab = $state<QueueTab>('all');
	let queuePollTimer: ReturnType<typeof setInterval> | null = null;
	let isRefreshing = $state(false);
	let refreshQueued = $state(false);

	const queueCounts = $derived.by(() => buildQueueCounts(queueJobs));
	const visibleJobs = $derived.by(() => filterQueueJobs(queueJobs, activeTab));

	onMount(() => {
		void refreshQueueStatus(true);
		queuePollTimer = setInterval(() => {
			void refreshQueueStatus(false);
		}, 5000);

		return () => {
			if (queuePollTimer) {
				clearInterval(queuePollTimer);
			}
		};
	});

	async function refreshQueueStatus(showLoader: boolean): Promise<void> {
		if (isRefreshing) {
			refreshQueued = true;
			return;
		}

		isRefreshing = true;
		if (showLoader) {
			isLoading = true;
		}

		try {
			const result = await ZUI.getQueueStatus();
			if (!result.ok) {
				error = result.error;
				return;
			}

			error = null;
			queueJobs = result.value.jobs as QueueJob[];
		} finally {
			if (showLoader) {
				isLoading = false;
			}
			isRefreshing = false;
			if (refreshQueued) {
				refreshQueued = false;
				void refreshQueueStatus(false);
			}
		}
	}
</script>

<div class={styles.root}>
	<Loading bind:show={isLoading} />

	{#if error}
		<SectionErrorBanner message={error.message} onRetry={() => void refreshQueueStatus(true)} />
	{/if}

	<QueueStatsGrid counts={queueCounts} />
	<QueueTabs activeTab={activeTab} counts={queueCounts} onChange={(tab) => (activeTab = tab)} />

	{#if visibleJobs.length === 0 && !isLoading}
		<QueueEmptyState />
	{:else}
		<div class={styles.list}>
			{#each visibleJobs as job (job.id)}
				<QueueJobCard {job} />
			{/each}
		</div>
	{/if}
</div>
