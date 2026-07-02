export interface ReaderWakeLockSentinel {
	readonly released: boolean;
	release(): Promise<void>;
}

export interface ReaderWakeLockSource {
	request(type: 'screen'): Promise<ReaderWakeLockSentinel>;
}

export interface ReaderVisibilitySource {
	readonly visibilityState: DocumentVisibilityState;
	addEventListener(type: 'visibilitychange', listener: EventListener): void;
	removeEventListener(type: 'visibilitychange', listener: EventListener): void;
}

function browserWakeLock(): ReaderWakeLockSource | undefined {
	if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
		return undefined;
	}

	return navigator.wakeLock;
}

function browserVisibility(): ReaderVisibilitySource | undefined {
	return typeof document === 'undefined' ? undefined : document;
}

async function releaseQuietly(sentinel: ReaderWakeLockSentinel): Promise<void> {
	if (sentinel.released) {
		return;
	}

	try {
		await sentinel.release();
	} catch {
		// Wake lock availability is best-effort and must never interrupt reading.
	}
}

export function startReaderWakeLock(
	wakeLock: ReaderWakeLockSource | undefined = browserWakeLock(),
	visibility: ReaderVisibilitySource | undefined = browserVisibility()
): () => void {
	if (!wakeLock || !visibility) {
		return () => undefined;
	}

	let sentinel: ReaderWakeLockSentinel | null = null;
	let requestInFlight: Promise<void> | null = null;
	let isStopped = false;

	const acquire = async (): Promise<void> => {
		if (
			isStopped ||
			visibility.visibilityState !== 'visible' ||
			(sentinel !== null && !sentinel.released) ||
			requestInFlight !== null
		) {
			return;
		}

		const request = (async (): Promise<void> => {
			try {
				const acquiredSentinel = await wakeLock.request('screen');
				if (isStopped || visibility.visibilityState !== 'visible') {
					await releaseQuietly(acquiredSentinel);
					return;
				}
				sentinel = acquiredSentinel;
			} catch {
				// Unsupported, denied, or interrupted requests should leave the reader usable.
			}
		})();

		requestInFlight = request;
		try {
			await request;
		} finally {
			if (requestInFlight === request) {
				requestInFlight = null;
			}
		}
	};

	const handleVisibilityChange: EventListener = () => {
		if (visibility.visibilityState === 'visible') {
			void acquire();
		}
	};

	visibility.addEventListener('visibilitychange', handleVisibilityChange);
	void acquire();

	return () => {
		if (isStopped) {
			return;
		}

		isStopped = true;
		visibility.removeEventListener('visibilitychange', handleVisibilityChange);
		const activeSentinel = sentinel;
		sentinel = null;
		if (activeSentinel) {
			void releaseQuietly(activeSentinel);
		}
	};
}
