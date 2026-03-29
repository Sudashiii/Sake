import type { WebappLogEntry, WebappLogSnapshot } from '$lib/types/Logs/WebappLogEntry';

export interface WebappLogStreamHandlers {
	onOpen?: () => void;
	onError?: () => void;
	onSnapshot?: (entries: WebappLogEntry[]) => void;
	onEntry?: (entry: WebappLogEntry) => void;
}

export interface WebappLogStreamConnection {
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

export function createWebappLogStream(handlers: WebappLogStreamHandlers): WebappLogStreamConnection {
	const eventSource = new EventSource('/api/logs/webapp/stream');

	eventSource.addEventListener('open', () => {
		handlers.onOpen?.();
	});

	eventSource.addEventListener('snapshot', (event) => {
		const payload = parseMessageData<WebappLogSnapshot>(event);
		if (!payload) {
			return;
		}

		handlers.onSnapshot?.(payload.entries);
	});

	eventSource.addEventListener('entry', (event) => {
		const payload = parseMessageData<WebappLogEntry>(event);
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
