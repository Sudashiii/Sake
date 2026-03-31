import type { WebappLogEntry } from '$lib/types/Logs/WebappLogEntry';

export interface WebappLogObservation {
	snapshot: WebappLogEntry[];
	subscribe(listener: (entry: WebappLogEntry) => void): () => void;
}

export interface WebappLogFeedPort {
	observe(): WebappLogObservation;
}
