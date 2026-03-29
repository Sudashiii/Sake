<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { createWebappLogStream } from '$lib/client/logs/createWebappLogStream';
	import {
		LOGS_TABS,
		formatLogDetails,
		formatLogLevel,
		formatLogTimestamp,
		getContextPreview,
		hasLogDetails,
		isLogsSourceAvailable,
		type LogsSource
	} from '$lib/features/logs/logsView';
	import {
		WEBAPP_LOG_BACKLOG_LIMIT,
		type WebappLogEntry
	} from '$lib/types/Logs/WebappLogEntry';
	import styles from './page.module.scss';

	type StreamState = 'connecting' | 'live' | 'reconnecting' | 'disconnected';

	let activeSource = $state<LogsSource>('webapp');
	let streamState = $state<StreamState>('connecting');
	let logEntries = $state<WebappLogEntry[]>([]);
	let feedEl = $state<HTMLDivElement | null>(null);
	let shouldStickToBottom = $state(true);
	let supportMessage = $state<string | null>(null);
	let hasConnectedOnce = false;
	let closedByPage = false;

	function limitEntries(entries: WebappLogEntry[]): WebappLogEntry[] {
		return entries.slice(-WEBAPP_LOG_BACKLOG_LIMIT);
	}

	function selectSource(source: LogsSource): void {
		if (!isLogsSourceAvailable(source)) {
			return;
		}

		activeSource = source;
	}

	function updateAutoScrollPreference(): void {
		if (!feedEl) {
			return;
		}

		const distanceFromBottom =
			feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight;
		shouldStickToBottom = distanceFromBottom <= 48;
	}

	function getStatusLabel(state: StreamState): string {
		if (state === 'live') return 'Live';
		if (state === 'reconnecting') return 'Reconnecting';
		if (state === 'disconnected') return 'Disconnected';
		return 'Connecting';
	}

	function getStatusClass(state: StreamState): string {
		if (state === 'live') return styles.statusLive;
		if (state === 'reconnecting') return styles.statusReconnecting;
		if (state === 'disconnected') return styles.statusDisconnected;
		return styles.statusConnecting;
	}

	$effect(() => {
		const latestEntryId = logEntries[logEntries.length - 1]?.id;
		void latestEntryId;

		if (!feedEl || !shouldStickToBottom || activeSource !== 'webapp') {
			return;
		}

		void tick().then(() => {
			if (!feedEl || !shouldStickToBottom) {
				return;
			}

			feedEl.scrollTop = feedEl.scrollHeight;
		});
	});

	onMount(() => {
		if (typeof EventSource === 'undefined') {
			streamState = 'disconnected';
			supportMessage = 'This browser does not support live EventSource streams.';
			return;
		}

		streamState = 'connecting';
		supportMessage = null;

		const connection = createWebappLogStream({
			onOpen: () => {
				hasConnectedOnce = true;
				streamState = 'live';
			},
			onSnapshot: (entries) => {
				logEntries = limitEntries(entries);
			},
			onEntry: (entry) => {
				logEntries = limitEntries([...logEntries, entry]);
			},
			onError: () => {
				if (closedByPage) {
					return;
				}

				streamState = hasConnectedOnce ? 'reconnecting' : 'connecting';
			}
		});

		return () => {
			closedByPage = true;
			connection.close();
		};
	});
</script>

<div class={styles.root}>
	<section class={styles.hero}>
		<div class={styles.heroCopy}>
			<h1>Live webapp logs</h1>
			<p>
				This feed shows logs emitted by the running Sake webapp process. It is
				process-local and resets when the server restarts.
			</p>
		</div>
		<div class={`${styles.statusBadge} ${getStatusClass(streamState)}`}>
			<span class={styles.statusDot} aria-hidden="true"></span>
			<span>{getStatusLabel(streamState)}</span>
		</div>
	</section>

	<div class={styles.tabs} role="tablist" aria-label="Log sources">
		{#each LOGS_TABS as tab}
			<button
				type="button"
				role="tab"
				class={`${styles.tabBtn} ${activeSource === tab.key ? styles.active : ''}`}
				aria-selected={activeSource === tab.key}
				disabled={!tab.available}
				onclick={() => selectSource(tab.key)}
				title={tab.description}
			>
				<span>{tab.label}</span>
				{#if !tab.available}
					<span class={styles.soonBadge}>Soon</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if supportMessage}
		<div class={styles.notice}>{supportMessage}</div>
	{/if}

	{#if activeSource === 'webapp'}
		<section class={styles.feedPanel}>
			<div class={styles.feedToolbar}>
				<span>{logEntries.length} buffered entr{logEntries.length === 1 ? 'y' : 'ies'}</span>
				<span>Newest entries appear at the bottom</span>
			</div>

			<div class={styles.feed} bind:this={feedEl} onscroll={updateAutoScrollPreference}>
				{#if logEntries.length === 0}
					<div class={styles.emptyState}>
						<p>Waiting for webapp logs...</p>
						<p>New entries will appear here as the server emits them.</p>
					</div>
				{:else}
					{#each logEntries as entry (entry.id)}
						{@const previewItems = getContextPreview(entry)}
						<article class={styles.entry}>
							<div class={styles.entryHeader}>
								<span class={`${styles.levelBadge} ${styles[`level_${entry.level}`] ?? styles.level_unknown}`}>
									{formatLogLevel(entry.level)}
								</span>
								<time datetime={entry.timestamp}>{formatLogTimestamp(entry.timestamp)}</time>
							</div>

							<p class={styles.message}>{entry.message}</p>

							{#if previewItems.length > 0}
								<div class={styles.contextPreview}>
									{#each previewItems as item}
										<span class={styles.contextChip}>
											<strong>{item.key}</strong>
											<span>{item.value}</span>
										</span>
									{/each}
								</div>
							{/if}

							{#if hasLogDetails(entry)}
								<div class={styles.details}>
									<div class={styles.detailsLabel}>Details</div>
									<pre>{formatLogDetails(entry)}</pre>
								</div>
							{/if}
						</article>
					{/each}
				{/if}
			</div>
		</section>
	{:else}
		<section class={styles.placeholderPanel}>
			<h2>Device logs are coming soon</h2>
			<p>
				This tab is reserved for future device-side log ingestion and streaming.
			</p>
		</section>
	{/if}
</div>
