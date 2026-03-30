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

type DeviceLogListener = (entry: DeviceLogEntry) => void;

interface DeviceLogState {
	entries: DeviceLogEntry[];
	lastTouchedOrder: number;
}

function cloneEntry(entry: DeviceLogEntry): DeviceLogEntry {
	return { ...entry };
}

export class InMemoryDeviceLogFeed implements DeviceLogFeedPort {
	private readonly backlogLimit: number;
	private readonly maxTrackedDevices: number;
	private readonly deviceStates = new Map<string, DeviceLogState>();
	private readonly deviceSubscribers = new Map<string, Set<DeviceLogListener>>();
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

		for (const subscriber of this.deviceSubscribers.get(entry.deviceId) ?? []) {
			subscriber(cloneEntry(storedEntry));
		}

		return cloneEntry(storedEntry);
	}

	observe(deviceId: string): DeviceLogObservation {
		const state = this.deviceStates.get(deviceId);
		if (state) {
			state.lastTouchedOrder = this.nextTouchOrder();
		}

		return {
			snapshot: state?.entries.map(cloneEntry) ?? [],
			subscribe: (listener) => {
				const subscribers = this.getSubscribers(deviceId);
				subscribers.add(listener);
				return () => {
					subscribers.delete(listener);
					if (subscribers.size === 0) {
						this.deviceSubscribers.delete(deviceId);
					}
				};
			}
		};
	}

	private getDeviceState(deviceId: string): DeviceLogState {
		let state = this.deviceStates.get(deviceId);
		if (!state) {
			state = {
				entries: [],
				lastTouchedOrder: this.nextTouchOrder()
			};
			this.deviceStates.set(deviceId, state);
			this.pruneDeviceStates();
		}
		state.lastTouchedOrder = this.nextTouchOrder();
		return state;
	}

	private getSubscribers(deviceId: string): Set<DeviceLogListener> {
		const existingSubscribers = this.deviceSubscribers.get(deviceId);
		if (existingSubscribers) {
			return existingSubscribers;
		}

		const subscribers = new Set<DeviceLogListener>();
		this.deviceSubscribers.set(deviceId, subscribers);
		return subscribers;
	}

	private pruneDeviceStates(): void {
		if (this.deviceStates.size <= this.maxTrackedDevices) {
			return;
		}

		const evictableStates = [...this.deviceStates.entries()]
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
