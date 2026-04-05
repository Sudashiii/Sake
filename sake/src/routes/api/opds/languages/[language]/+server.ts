import type { RequestHandler } from '@sveltejs/kit';
import { requireBasicAuth } from '../../auth';
import { listLibraryUseCase } from '$lib/server/application/composition';
import { renderAcquisitionFeed } from '../../feedBuilder';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';

export const GET: RequestHandler = async (event) => {
	const authResponse = await requireBasicAuth(event);
	if (authResponse) return authResponse;

	const { params, locals } = event;
	const requestLogger = getRequestLogger(locals);
	const languageCode = params.language;

	if (!languageCode) {
		return errorResponse('Missing language parameter', 400);
	}

	try {
		const result = await listLibraryUseCase.execute();
		if (!result.ok) {
			return errorResponse(result.error.message, result.error.status);
		}

		// Filter by language and sort alphabetically
		const books = result.value.books.filter(
			(book) => book.language === languageCode
		).sort((a, b) => a.title.localeCompare(b.title));
		
		const selfUrl = `/api/opds/languages/${encodeURIComponent(languageCode)}`;

		const xml = renderAcquisitionFeed(
			`Books in ${languageCode.toUpperCase()}`,
			`urn:sake:opds:language:${encodeURIComponent(languageCode)}`,
			books,
			selfUrl
		);

		return new Response(xml, {
			headers: {
				'Content-Type': 'application/atom+xml;charset=utf-8'
			}
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'opds.language.books.failed', error: err }, 'Failed to generate language books feed');
		return errorResponse('Internal Server Error', 500);
	}
};
