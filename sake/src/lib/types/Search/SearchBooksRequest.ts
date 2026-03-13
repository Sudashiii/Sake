import type { SearchProviderId } from '$lib/types/Search/Provider';

export interface SearchBooksFilters {
	language?: string[];
	extension?: string[];
	yearFrom?: number;
	yearTo?: number;
	limitPerProvider?: number;
}

export interface SearchBooksRequest {
	query: string;
	providers?: SearchProviderId[];
	filters?: SearchBooksFilters;
	sort?: 'relevance' | 'year_desc' | 'year_asc' | 'title_asc';
}
