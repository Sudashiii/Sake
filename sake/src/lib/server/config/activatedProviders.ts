import { env } from '$env/dynamic/private';
import type { SearchProviderId } from '$lib/types/Search/Provider';
import { parseActivatedSearchProviders } from './activatedProviders.shared';

export function getActivatedSearchProviders(): SearchProviderId[] {
	return parseActivatedSearchProviders(env.ACTIVATED_PROVIDERS);
}

export function isSearchEnabled(): boolean {
	return getActivatedSearchProviders().length > 0;
}

export function getSearchActivationConfig(): {
	activeSearchProviders: SearchProviderId[];
	searchEnabled: boolean;
} {
	const activeSearchProviders = getActivatedSearchProviders();
	return {
		activeSearchProviders,
		searchEnabled: activeSearchProviders.length > 0
	};
}
