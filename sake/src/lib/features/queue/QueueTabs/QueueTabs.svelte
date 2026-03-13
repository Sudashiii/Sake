<script lang="ts">
	import AlertCircleIcon from '$lib/assets/icons/AlertCircleIcon.svelte';
	import CheckCircleIcon from '$lib/assets/icons/CheckCircleIcon.svelte';
	import ClockIcon from '$lib/assets/icons/ClockIcon.svelte';
	import ListIcon from '$lib/assets/icons/ListIcon.svelte';
	import LoaderCircleIcon from '$lib/assets/icons/LoaderCircleIcon.svelte';
	import { QUEUE_TABS, type QueueTab } from '../queueView';
	import styles from './QueueTabs.module.scss';

	interface Props {
		activeTab: QueueTab;
		counts: Record<QueueTab, number>;
		onChange: (tab: QueueTab) => void;
	}

	let { activeTab, counts, onChange }: Props = $props();
</script>

<div class={styles.root} role="tablist" aria-label="Queue filters">
	{#each QUEUE_TABS as tab}
		<button
			type="button"
			role="tab"
			class={`${styles.tabBtn} ${activeTab === tab.key ? styles.active : ''}`}
			aria-selected={activeTab === tab.key}
			onclick={() => onChange(tab.key)}
		>
			<span class={styles.tabIcon} aria-hidden="true">
				{#if tab.key === 'all'}
					<ListIcon size={14} strokeWidth={2.1} />
				{:else if tab.key === 'queued'}
					<ClockIcon size={14} strokeWidth={2.1} />
				{:else if tab.key === 'processing'}
					<LoaderCircleIcon size={14} strokeWidth={2.1} class={styles.spinIcon} />
				{:else if tab.key === 'completed'}
					<CheckCircleIcon size={14} strokeWidth={2.1} />
				{:else}
					<AlertCircleIcon size={14} strokeWidth={2.1} />
				{/if}
			</span>
			<span>{tab.label}</span>
			<span class={styles.tabCount}>{counts[tab.key]}</span>
		</button>
	{/each}
</div>
