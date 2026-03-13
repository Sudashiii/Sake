<script lang="ts">
	import type { BookProgressHistoryEntry } from '$lib/types/Library/BookProgressHistory';
	import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
	import {
		clampProgress,
		formatDateTime,
		getCurrentPage,
		getProgressHistoryPageRange
	} from '$lib/features/library/libraryView';
	import styles from './LibraryDetailProgressTab.module.scss';

	interface Props {
		selectedBookDetail: LibraryBookDetail;
		progressHistory: BookProgressHistoryEntry[];
		isProgressHistoryLoading?: boolean;
		progressHistoryError?: string | null;
		showProgressHistory?: boolean;
		previewCount?: number;
	}

	let {
		selectedBookDetail,
		progressHistory,
		isProgressHistoryLoading = false,
		progressHistoryError = null,
		showProgressHistory = $bindable(false),
		previewCount = 5
	}: Props = $props();

	const hasMoreProgressHistory = $derived(progressHistory.length > previewCount);
	const visibleProgressHistory = $derived(
		showProgressHistory ? progressHistory : progressHistory.slice(0, previewCount)
	);
</script>

<div class={styles.root}>
	<div class="detail-v2-current-progress">
		<div class="detail-v2-progress-summary">
			<h3>Current Progress</h3>
			<span>{clampProgress(selectedBookDetail.progressPercent).toFixed(0)}%</span>
		</div>
		<div class="detail-v2-progress-track">
			<div class="detail-v2-progress-fill" style={`width: ${clampProgress(selectedBookDetail.progressPercent)}%`}></div>
		</div>
		{#if getCurrentPage(selectedBookDetail.progressPercent, selectedBookDetail.pages) !== null}
			<p class="detail-muted">
				~{getCurrentPage(selectedBookDetail.progressPercent, selectedBookDetail.pages)} of {selectedBookDetail.pages} pages read
			</p>
		{/if}
	</div>

	<div class="detail-v2-history">
		<div class="detail-v2-history-head">
			<p class="detail-v2-caption">Progress History ({progressHistory.length} entries)</p>
			{#if hasMoreProgressHistory}
				<button type="button" onclick={() => (showProgressHistory = !showProgressHistory)}>
					{showProgressHistory ? 'Show Less' : `Show All (${progressHistory.length})`}
				</button>
			{/if}
		</div>

		{#if isProgressHistoryLoading}
			<p class="detail-muted">Loading progress history...</p>
		{:else if progressHistoryError}
			<p class="detail-error">{progressHistoryError}</p>
		{:else if progressHistory.length === 0}
			<p class="detail-muted">No progress history yet.</p>
		{:else}
			<ul class="detail-v2-history-list">
				{#each visibleProgressHistory as entry, index (`${entry.recordedAt}-${entry.progressPercent}-${index}`)}
					<li>
						<div class="detail-v2-history-dot"></div>
						<div class="detail-v2-history-card">
							<div class="detail-v2-history-row">
								<span>{formatDateTime(entry.recordedAt)}</span>
								<span>{clampProgress(entry.progressPercent).toFixed(1)}%</span>
							</div>
							<div class="detail-v2-progress-track">
								<div class="detail-v2-progress-fill" style={`width: ${clampProgress(entry.progressPercent)}%`}></div>
							</div>
							{#if getProgressHistoryPageRange(progressHistory, index, selectedBookDetail.pages)}
								<span class="detail-v2-history-range">
									{getProgressHistoryPageRange(progressHistory, index, selectedBookDetail.pages)}
								</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
