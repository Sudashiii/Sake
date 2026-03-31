<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { createDeviceLogStream } from '$lib/client/logs/createDeviceLogStream';
	import { createWebappLogStream } from '$lib/client/logs/createWebappLogStream';
	import { getDevices } from '$lib/client/routes/getDevices';
	import {
		LOGS_TABS,
		formatDeviceLogSource,
		formatLogDetails,
		formatLogLevel,
		formatLogTimestamp,
		getContextPreview,
		hasLogDetails,
		isLogsSourceAvailable,
		type LogsSource
	} from '$lib/features/logs/logsView';
	import type { RegisteredDevice } from '$lib/types/Auth/Device';
	import {
		DEVICE_LOG_BACKLOG_LIMIT,
		type DeviceLogEntry
	} from '$lib/types/Logs/DeviceLogEntry';
	import {
		WEBAPP_LOG_BACKLOG_LIMIT,
		type WebappLogEntry
	} from '$lib/types/Logs/WebappLogEntry';
	import styles from './page.module.scss';

	type StreamState = 'connecting' | 'live' | 'reconnecting' | 'disconnected';
	type DevicesState = 'idle' | 'loading' | 'loaded' | 'error';
	type LogStreamConnection = { close(): void };

	let activeSource = $state<LogsSource>('webapp');
	let webappStreamState = $state<StreamState>('connecting');
	let deviceStreamState = $state<StreamState>('disconnected');
	let webappEntries = $state<WebappLogEntry[]>([]);
	let deviceEntries = $state<DeviceLogEntry[]>([]);
	let devices = $state<RegisteredDevice[]>([]);
	let devicesState = $state<DevicesState>('idle');
	let selectedDeviceId = $state('');
	let deviceNotice = $state<string | null>(null);
	let browserSupportMessage = $state<string | null>(null);
	let feedEl = $state<HTMLDivElement | null>(null);
	let shouldStickToBottom = $state(true);
	let ready = $state(false);
	let destroyed = false;
	let activeConnection: LogStreamConnection | null = null;
	let activeConnectionToken = 0;
	let webappHasConnectedOnce = false;
	let deviceHasConnectedOnce = false;

	function limitWebappEntries(entries: WebappLogEntry[]): WebappLogEntry[] {
		return entries.slice(-WEBAPP_LOG_BACKLOG_LIMIT);
	}

	function limitDeviceEntries(entries: DeviceLogEntry[]): DeviceLogEntry[] {
		return entries.slice(-DEVICE_LOG_BACKLOG_LIMIT);
	}

	function getCurrentStreamState(): StreamState {
		return activeSource === 'webapp' ? webappStreamState : deviceStreamState;
	}

	function getHeroTitle(): string {
		return activeSource === 'webapp' ? 'Live webapp logs' : 'Live device logs';
	}

	function getHeroDescription(): string {
		if (activeSource === 'webapp') {
			return 'This feed shows logs emitted by the running Sake webapp process. It is process-local and resets when the server restarts.';
		}

		if (selectedDeviceId) {
			return `This feed shows logs shipped from ${selectedDeviceId}. Remote shipping is opt-in on the device and logs reset when the server restarts.`;
		}

		return 'This feed shows logs shipped from the KOReader Sake plugin when remote log shipping is enabled on a device.';
	}

	function selectSource(source: LogsSource): void {
		if (!isLogsSourceAvailable(source)) {
			return;
		}

		activeSource = source;
		if (source === 'devices' && devicesState !== 'loaded') {
			void ensureDevicesLoaded();
		}
	}

	async function ensureDevicesLoaded(): Promise<void> {
		if (devicesState === 'loading' || devicesState === 'loaded') {
			return;
		}

		devicesState = 'loading';
		deviceNotice = null;
		deviceStreamState = 'connecting';

		const result = await getDevices();
		if (!result.ok) {
			devices = [];
			selectedDeviceId = '';
			devicesState = 'error';
			deviceStreamState = 'disconnected';
			deviceNotice = result.error.message;
			return;
		}

		devices = result.value.devices;
		devicesState = 'loaded';
		selectedDeviceId = devices[0]?.deviceId ?? '';
		if (devices.length === 0) {
			deviceStreamState = 'disconnected';
		}
	}

	function updateAutoScrollPreference(): void {
		if (!feedEl) {
			return;
		}

		const distanceFromBottom =
			feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight;
		shouldStickToBottom = distanceFromBottom <= 48;
	}

	function closeActiveConnection(): void {
		activeConnectionToken += 1;
		activeConnection?.close();
		activeConnection = null;
	}

	function connectWebappStream(): void {
		closeActiveConnection();
		const token = activeConnectionToken;
		webappStreamState = 'connecting';
		activeConnection = createWebappLogStream({
			onOpen: () => {
				if (destroyed || token !== activeConnectionToken) {
					return;
				}

				webappHasConnectedOnce = true;
				webappStreamState = 'live';
			},
			onSnapshot: (entries) => {
				if (destroyed || token !== activeConnectionToken) {
					return;
				}

				webappEntries = limitWebappEntries(entries);
			},
			onEntry: (entry) => {
				if (destroyed || token !== activeConnectionToken) {
					return;
				}

				webappEntries = limitWebappEntries([...webappEntries, entry]);
			},
			onError: () => {
				if (destroyed || token !== activeConnectionToken) {
					return;
				}

				webappStreamState = webappHasConnectedOnce ? 'reconnecting' : 'connecting';
			}
		});
	}

	function connectDeviceStream(): void {
		closeActiveConnection();

		if (devicesState === 'loading') {
			deviceStreamState = 'connecting';
			return;
		}

		if (devicesState === 'error') {
			deviceStreamState = 'disconnected';
			return;
		}

		if (!selectedDeviceId) {
			deviceEntries = [];
			deviceHasConnectedOnce = false;
			deviceStreamState = 'disconnected';
			return;
		}

		deviceEntries = [];
		deviceHasConnectedOnce = false;
		deviceStreamState = 'connecting';

		const token = activeConnectionToken;
		activeConnection = createDeviceLogStream(selectedDeviceId, {
			onOpen: () => {
				if (destroyed || token !== activeConnectionToken) {
					return;
				}

				deviceHasConnectedOnce = true;
				deviceStreamState = 'live';
			},
			onSnapshot: (entries) => {
				if (destroyed || token !== activeConnectionToken) {
					return;
				}

				deviceEntries = limitDeviceEntries(entries);
			},
			onEntry: (entry) => {
				if (destroyed || token !== activeConnectionToken) {
					return;
				}

				deviceEntries = limitDeviceEntries([...deviceEntries, entry]);
			},
			onError: () => {
				if (destroyed || token !== activeConnectionToken) {
					return;
				}

				deviceStreamState = deviceHasConnectedOnce ? 'reconnecting' : 'connecting';
			}
		});
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

	function getSelectedDevice(): RegisteredDevice | null {
		return devices.find((device) => device.deviceId === selectedDeviceId) ?? null;
	}

	function getDeviceEmptyTitle(): string {
		if (devicesState === 'loading') return 'Loading devices...';
		if (devicesState === 'error') return 'Unable to load devices.';
		if (devices.length === 0) return 'No devices found.';
		if (!selectedDeviceId) return 'Select a device to view logs.';
		if (deviceStreamState === 'connecting' || deviceStreamState === 'reconnecting') {
			return 'Connecting to device logs...';
		}
		if (deviceStreamState === 'disconnected') {
			return 'Device log stream disconnected.';
		}
		return 'Waiting for device logs...';
	}

	function getDeviceEmptyDescription(): string {
		if (devicesState === 'loading') {
			return 'Your registered devices are loading now.';
		}
		if (devicesState === 'error') {
			return deviceNotice ?? 'The device list could not be loaded.';
		}
		if (devices.length === 0) {
			return 'Register a device in Sake before trying to view shipped logs.';
		}
		if (!selectedDeviceId) {
			return 'Choose a device from the selector above to open its live log stream.';
		}
		if (deviceStreamState === 'connecting' || deviceStreamState === 'reconnecting') {
			return `Trying to connect to ${selectedDeviceId} now.`;
		}
		if (deviceStreamState === 'disconnected') {
			return 'Refresh the page or switch devices to reconnect.';
		}
		return 'New entries will appear here after remote log shipping is enabled on the device.';
	}

	$effect(() => {
		const latestEntryId =
			activeSource === 'webapp'
				? webappEntries[webappEntries.length - 1]?.id
				: deviceEntries[deviceEntries.length - 1]?.id;
		void latestEntryId;

		if (!feedEl || !shouldStickToBottom) {
			return;
		}

		void tick().then(() => {
			if (!feedEl || !shouldStickToBottom) {
				return;
			}

			feedEl.scrollTop = feedEl.scrollHeight;
		});
	});

	$effect(() => {
		if (!ready || browserSupportMessage) {
			return;
		}

		if (activeSource === 'webapp') {
			connectWebappStream();
			return;
		}

		void selectedDeviceId;
		void devicesState;
		connectDeviceStream();
	});

	$effect(() => {
		if (!ready || activeSource !== 'devices' || devicesState !== 'idle') {
			return;
		}

		void ensureDevicesLoaded();
	});

	onMount(() => {
		if (typeof EventSource === 'undefined') {
			browserSupportMessage = 'This browser does not support live EventSource streams.';
			webappStreamState = 'disconnected';
			deviceStreamState = 'disconnected';
		}
		ready = true;

		return () => {
			destroyed = true;
			closeActiveConnection();
		};
	});
</script>

<div class={styles.root}>
	<section class={styles.hero}>
		<div class={styles.heroCopy}>
			<h1>{getHeroTitle()}</h1>
			<p>{getHeroDescription()}</p>
		</div>
		<div class={`${styles.statusBadge} ${getStatusClass(getCurrentStreamState())}`}>
			<span class={styles.statusDot} aria-hidden="true"></span>
			<span>{getStatusLabel(getCurrentStreamState())}</span>
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
			</button>
		{/each}
	</div>

	{#if browserSupportMessage}
		<div class={styles.notice}>{browserSupportMessage}</div>
	{/if}

	{#if activeSource === 'webapp'}
		<section class={styles.feedPanel}>
			<div class={styles.feedToolbar}>
				<span>{webappEntries.length} buffered entr{webappEntries.length === 1 ? 'y' : 'ies'}</span>
				<span>Newest entries appear at the bottom</span>
			</div>

			<div class={styles.feed} bind:this={feedEl} onscroll={updateAutoScrollPreference}>
				{#if webappEntries.length === 0}
					<div class={styles.emptyState}>
						<p>Waiting for webapp logs...</p>
						<p>New entries will appear here as the server emits them.</p>
					</div>
				{:else}
					{#each webappEntries as entry (entry.id)}
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
		{@const selectedDevice = getSelectedDevice()}
		<section class={styles.feedPanel}>
			<div class={styles.feedToolbar}>
				<div class={styles.toolbarMeta}>
					<span>{deviceEntries.length} buffered entr{deviceEntries.length === 1 ? 'y' : 'ies'}</span>
					{#if selectedDevice}
						<span>Viewing {selectedDevice.deviceId}</span>
					{:else}
						<span>Select a device to start streaming</span>
					{/if}
				</div>

				<label class={styles.devicePicker}>
					<span>Device</span>
					<select
						class={styles.deviceSelect}
						bind:value={selectedDeviceId}
						disabled={devicesState === 'loading' || devices.length === 0}
					>
						{#if devices.length === 0}
							<option value="">
								{devicesState === 'loading' ? 'Loading devices...' : 'No devices available'}
							</option>
						{:else}
							{#each devices as device}
								<option value={device.deviceId}>{device.deviceId}</option>
							{/each}
						{/if}
					</select>
				</label>
			</div>

			{#if deviceNotice && devicesState === 'error'}
				<p class={styles.notice}>{deviceNotice}</p>
			{/if}

			<div class={styles.feed} bind:this={feedEl} onscroll={updateAutoScrollPreference}>
				{#if deviceEntries.length === 0}
					<div class={styles.emptyState}>
						<p>{getDeviceEmptyTitle()}</p>
						<p>{getDeviceEmptyDescription()}</p>
					</div>
				{:else}
					{#each deviceEntries as entry (entry.id)}
						<article class={styles.entry}>
							<div class={styles.entryHeader}>
								<div class={styles.entryHeaderMeta}>
									<span class={`${styles.levelBadge} ${styles[`level_${entry.level}`] ?? styles.level_unknown}`}>
										{formatLogLevel(entry.level)}
									</span>
									<span class={styles.sourceBadge}>{formatDeviceLogSource(entry.source)}</span>
								</div>
								<time datetime={entry.timestamp}>{formatLogTimestamp(entry.timestamp)}</time>
							</div>

							<p class={styles.message}>{entry.message}</p>
						</article>
					{/each}
				{/if}
			</div>
		</section>
	{/if}
</div>
