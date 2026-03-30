import type {
	AppendDeviceLogEntry,
	DeviceLogFeedPort,
	DeviceLogObservation
} from '$lib/server/application/ports/DeviceLogFeedPort';
import {
	DEVICE_LOG_BACKLOG_LIMIT,
	type DeviceLogEntry
} from '$lib/types/Logs/DeviceLogEntry';

interface DeviceLogState {
	entries: DeviceLogEntry[];
	subscribers: Set<(entry: DeviceLogEntry) => void>;
}

function cloneEntry(entry: DeviceLogEntry): DeviceLogEntry {
	return { ...entry };
}

export class InMemoryDeviceLogFeed implements DeviceLogFeedPort {
	private readonly backlogLimit: number;
	private readonly deviceStates = new Map<string, DeviceLogState>();
	private sequence = 0;

	constructor(backlogLimit = DEVICE_LOG_BACKLOG_LIMIT) {
		this.backlogLimit = backlogLimit;
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
				subscribers: new Set()
			};
			this.deviceStates.set(deviceId, state);
		}
		return state;
	}
}

export const deviceLogFeed = new InMemoryDeviceLogFeed();
