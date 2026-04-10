import type { RequestHandler } from '@sveltejs/kit';
import { requireBasicAuth } from '../../auth';
import { listLibraryUseCase } from '$lib/server/application/composition';
import { renderAcquisitionFeed } from '../../feedBuilder';
import { errorResponse } from '$lib/server/http/api';
import { getRequestLogger } from '$lib/server/http/requestLogger';

export const GET: RequestHandler = async (event) => {
	const authResponse = await requireBasicAuth(event);
	if (authResponse) return authResponse;

	const { params, locals, url } = event;
	const requestLogger = getRequestLogger(locals);
	const authorName = params.author;

	if (!authorName) {
		return errorResponse('Missing author parameter', 400);
	}

	try {
		const result = await listLibraryUseCase.execute();
		if (!result.ok) {
			return errorResponse(result.error.message, result.error.status);
		}

		const books = result.value.books.filter(
			(book) => book.author === authorName
		).sort((a, b) => a.title.localeCompare(b.title));
		
		const selfUrl = `/api/opds/authors/${encodeURIComponent(authorName)}`;

		const xml = renderAcquisitionFeed(
			`Books by ${authorName}`,
			`urn:sake:opds:author:${encodeURIComponent(authorName)}`,
			books,
			selfUrl
		);

		return new Response(xml, {
			headers: {
				'Content-Type': 'application/atom+xml;charset=utf-8'
			}
		});
	} catch (err: unknown) {
		requestLogger.error({ event: 'opds.author.books.failed', error: err }, 'Failed to generate author books feed');
		return errorResponse('Internal Server Error', 500);
	}
};
