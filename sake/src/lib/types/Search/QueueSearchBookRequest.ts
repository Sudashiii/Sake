import type { SearchProviderId } from '$lib/types/Search/Provider';

export type QueueableSearchProviderId = Exclude<SearchProviderId, 'zlibrary'>;

export interface QueueSearchBookRequest {
	provider: QueueableSearchProviderId;
	providerBookId: string;
	downloadRef: string;
	title: string;
	extension?: string | null;
	author?: string | null;
	series?: string | null;
	volume?: string | null;
	seriesIndex?: number | null;
	identifier?: string | null;
	pages?: number | null;
	description?: string | null;
	cover?: string | null;
	filesize?: number | null;
	language?: string | null;
	year?: number | null;
}
