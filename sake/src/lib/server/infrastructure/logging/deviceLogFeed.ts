import type {
	AppendDeviceLogEntry,
	DeviceLogFeedPort,
	DeviceLogObservation
} from '$lib/server/application/ports/DeviceLogFeedPort';
import {
	DEVICE_LOG_BACKLOG_LIMIT,
	type DeviceLogEntry
} from '$lib/types/Logs/DeviceLogEntry';

const MAX_TRACKED_DEVICE_STATES = 100;

interface DeviceLogState {
	entries: DeviceLogEntry[];
	subscribers: Set<(entry: DeviceLogEntry) => void>;
	lastTouchedOrder: number;
}

function cloneEntry(entry: DeviceLogEntry): DeviceLogEntry {
	return { ...entry };
}

export class InMemoryDeviceLogFeed implements DeviceLogFeedPort {
	private readonly backlogLimit: number;
	private readonly maxTrackedDevices: number;
	private readonly deviceStates = new Map<string, DeviceLogState>();
	private sequence = 0;
	private touchSequence = 0;

	constructor(
		backlogLimit = DEVICE_LOG_BACKLOG_LIMIT,
		maxTrackedDevices = MAX_TRACKED_DEVICE_STATES
	) {
		this.backlogLimit = backlogLimit;
		this.maxTrackedDevices = maxTrackedDevices;
	}

	append(entry: AppendDeviceLogEntry): DeviceLogEntry {
		this.sequence += 1;
		const state = this.getDeviceState(entry.deviceId);
		const storedEntry: DeviceLogEntry = {
			id: `${this.sequence}-${entry.deviceId}-${entry.timestamp}`,
			...entry
		};

		state.entries.push(storedEntry);
		if (state.entries.length > this.backlogLimit) {
			state.entries.splice(0, state.entries.length - this.backlogLimit);
		}

		for (const subscriber of state.subscribers) {
			subscriber(cloneEntry(storedEntry));
		}

		return cloneEntry(storedEntry);
	}

	observe(deviceId: string): DeviceLogObservation {
		const state = this.getDeviceState(deviceId);
		return {
			snapshot: state.entries.map(cloneEntry),
			subscribe: (listener) => {
				state.subscribers.add(listener);
				return () => {
					state.subscribers.delete(listener);
				};
			}
		};
	}

	private getDeviceState(deviceId: string): DeviceLogState {
		let state = this.deviceStates.get(deviceId);
		if (!state) {
			state = {
				entries: [],
				subscribers: new Set(),
				lastTouchedOrder: this.nextTouchOrder()
			};
			this.deviceStates.set(deviceId, state);
			this.pruneInactiveDeviceStates();
		}
		state.lastTouchedOrder = this.nextTouchOrder();
		return state;
	}

	private pruneInactiveDeviceStates(): void {
		if (this.deviceStates.size <= this.maxTrackedDevices) {
			return;
		}

		const evictableStates = [...this.deviceStates.entries()]
			.filter(([, state]) => state.subscribers.size === 0)
			.sort((left, right) => left[1].lastTouchedOrder - right[1].lastTouchedOrder);

		while (this.deviceStates.size > this.maxTrackedDevices && evictableStates.length > 0) {
			const [deviceId] = evictableStates.shift()!;
			this.deviceStates.delete(deviceId);
		}
	}

	private nextTouchOrder(): number {
		this.touchSequence += 1;
		return this.touchSequence;
	}
}

export const deviceLogFeed = new InMemoryDeviceLogFeed();
