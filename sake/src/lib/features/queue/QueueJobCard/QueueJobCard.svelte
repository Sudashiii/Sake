<script lang="ts">
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import CheckCircleIcon from '$lib/assets/icons/CheckCircleIcon.svelte';
	import ClockIcon from '$lib/assets/icons/ClockIcon.svelte';
	import LoaderCircleIcon from '$lib/assets/icons/LoaderCircleIcon.svelte';
	import {
		formatQueueDateTime,
		getJobAuthor,
		getProgress,
		getRetryLimit,
		statusLabel,
		type QueueJob
	} from '../queueView';
	import styles from './QueueJobCard.module.scss';

	interface Props {
		job: QueueJob;
	}

	let { job }: Props = $props();

	const progress = $derived(getProgress(job));
	const retryLimit = $derived(getRetryLimit(job));
</script>

<article class={`${styles.root} ${job.status === 'failed' ? styles.failed : ''}`}>
	<div class={styles.head}>
		<div class={styles.headLeft}>
			<span class={`${styles.jobIcon} ${styles[job.status]}`} aria-hidden="true">
				{#if job.status === 'queued'}
					<ClockIcon size={16} strokeWidth={2.1} />
				{:else if job.status === 'processing'}
					<LoaderCircleIcon size={16} strokeWidth={2.1} class={styles.spinIcon} />
				{:else if job.status === 'completed'}
					<CheckCircleIcon size={16} strokeWidth={2.1} />
				{:else}
					<AlertCircleIcon size={16} strokeWidth={2.1} />
				{/if}
			</span>
			<div class={styles.titleBlock}>
				<div class={styles.titleRow}>
					<p class={styles.title} title={job.title}>{job.title}</p>
					<span class={`${styles.statusPill} ${styles[`status${statusLabel(job.status)}`]}`}>
						{#if job.status === 'processing'}
							<LoaderCircleIcon size={12} strokeWidth={2.1} class={`${styles.spinIcon} ${styles.statusPillIcon}`} />
						{/if}
						{statusLabel(job.status)}
					</span>
				</div>
				<p class={styles.author}>{getJobAuthor(job)}</p>
			</div>
		</div>
	</div>

	{#if job.status === 'processing' && progress !== null}
		<div class={styles.progressWrap}>
			<div class={styles.progressTrack}>
				<div
					class={styles.progressFill}
					style={`width: ${progress}%; background: ${
						progress === 100 ? '#4ade80' : 'linear-gradient(90deg, #c9a962, #e0c878)'
					}`}
				></div>
			</div>
			<span>{progress}%</span>
		</div>
	{/if}

	{#if job.error}
		<p class={styles.errorMsg}>{job.error}</p>
	{/if}

	<div class={styles.metaGrid}>
		<div>
			<span>Created</span>
			<p>{formatQueueDateTime(job.createdAt)}</p>
		</div>
		<div>
			<span>Updated</span>
			<p>{formatQueueDateTime(job.updatedAt)}</p>
		</div>
		{#if job.finishedAt}
			<div>
				<span>Finished</span>
				<p>{formatQueueDateTime(job.finishedAt)}</p>
			</div>
		{/if}
		<div>
			<span>Retries</span>
			<p>
				{job.attempts}/{retryLimit}
				{#if job.status === 'failed' && job.attempts >= retryLimit}
					<em>(max reached)</em>
				{/if}
			</p>
		</div>
	</div>
</article>
