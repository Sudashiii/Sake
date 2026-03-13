import { getSearchActivationConfig } from '$lib/server/config/activatedProviders';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	return getSearchActivationConfig();
};
