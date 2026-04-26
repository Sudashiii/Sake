import { activatedMetadataProviders } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	if (activatedMetadataProviders.length === 0) {
		return errorResponse('Metadata lookup is not enabled', 404);
	}

	const providers = activatedMetadataProviders.map((p) => ({
		id: p.id,
		capabilities: {
			touchedFields: [...p.capabilities.touchedFields],
			hasCover: p.capabilities.hasCover,
			hasRating: p.capabilities.hasRating,
			requiresIsbn: p.capabilities.requiresIsbn
		}
	}));

	return json({ providers });
};
