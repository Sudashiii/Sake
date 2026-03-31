import type { DeviceLogEntry, DeviceLogSnapshot } from '$lib/types/Logs/DeviceLogEntry';

export interface DeviceLogStreamHandlers {
	onOpen?: () => void;
	onError?: () => void;
	onSnapshot?: (entries: DeviceLogEntry[]) => void;
	onEntry?: (entry: DeviceLogEntry) => void;
}

export interface DeviceLogStreamConnection {
	close(): void;
}

function parseMessageData<T>(event: Event): T | null {
	const messageEvent = event as MessageEvent<string>;

	if (typeof messageEvent.data !== 'string' || messageEvent.data.trim().length === 0) {
		return null;
	}

	try {
		return JSON.parse(messageEvent.data) as T;
	} catch {
		return null;
	}
}

export function createDeviceLogStream(
	deviceId: string,
	handlers: DeviceLogStreamHandlers
): DeviceLogStreamConnection {
	const eventSource = new EventSource(`/api/devices/${encodeURIComponent(deviceId)}/logs/stream`);

	eventSource.addEventListener('open', () => {
		handlers.onOpen?.();
	});

	eventSource.addEventListener('snapshot', (event) => {
		const payload = parseMessageData<DeviceLogSnapshot>(event);
		if (!payload) {
			return;
		}

		handlers.onSnapshot?.(payload.entries);
	});

	eventSource.addEventListener('entry', (event) => {
		const payload = parseMessageData<DeviceLogEntry>(event);
		if (!payload) {
			return;
		}

		handlers.onEntry?.(payload);
	});

	eventSource.addEventListener('error', () => {
		handlers.onError?.();
	});

	return {
		close() {
			eventSource.close();
		}
	};
}
