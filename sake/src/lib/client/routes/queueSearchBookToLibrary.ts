import { type Result, err, ok } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { QueueSearchBookRequest } from '$lib/types/Search/QueueSearchBookRequest';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';
import type { ZDownloadBookRequest } from '$lib/types/ZLibrary/Requests/ZDownloadBookRequest';
import { post } from '../base/post';
import { ZUIRoutes } from '../base/routes';

export interface QueueSearchBookResponse {
	taskId: string | null;
	message: string;
	queueStatus: {
		pending: number;
		processing: number;
	};
	mode: 'queued' | 'imported';
}

function toQueueRequest(book: SearchResultBook): Result<ZDownloadBookRequest, ApiError> {
	if (book.provider !== 'zlibrary') {
		return err(ApiErrors.validation('Selected provider does not support queueing to library'));
	}
	if (!book.queueRef) {
		return err(ApiErrors.validation('Missing queue reference for selected book'));
	}

	return ok({
		bookId: book.providerBookId,
		hash: book.queueRef,
		title: book.title,
		upload: true,
		extension: book.extension ?? 'epub',
		author: book.author ?? undefined,
		series: book.series ?? undefined,
		volume: book.volume ?? undefined,
		seriesIndex: book.seriesIndex ?? undefined,
		identifier: book.identifier ?? undefined,
		pages: book.pages ?? undefined,
		description: book.description ?? undefined,
		cover: book.cover ?? undefined,
		filesize: book.filesize ?? undefined,
		language: book.language ?? undefined,
		year: book.year ?? undefined,
		downloadToDevice: false
	});
}

function toSearchQueueRequest(book: SearchResultBook): Result<QueueSearchBookRequest, ApiError> {
	if (book.provider === 'zlibrary') {
		return err(ApiErrors.validation('Selected provider must use the Z-Library queue endpoint'));
	}
	if (!book.downloadRef) {
		return err(ApiErrors.validation('Selected provider does not expose a downloadable file'));
	}

	return ok({
		provider: book.provider,
		providerBookId: book.providerBookId,
		downloadRef: book.downloadRef,
		title: book.title,
		extension: book.extension ?? null,
		author: book.author ?? null,
		series: book.series ?? null,
		volume: book.volume ?? null,
		seriesIndex: book.seriesIndex ?? null,
		identifier: book.identifier ?? null,
		pages: book.pages ?? null,
		description: book.description ?? null,
		cover: book.cover ?? null,
		filesize: book.filesize ?? null,
		language: book.language ?? null,
		year: book.year ?? null
	});
}

export async function queueSearchBookToLibrary(
	book: SearchResultBook
): Promise<Result<QueueSearchBookResponse, ApiError>> {
	if (book.provider === 'zlibrary') {
		const request = toQueueRequest(book);
		if (!request.ok) {
			return request;
		}

		const result = await post('/zlibrary/queue', JSON.stringify(request.value));
		if (!result.ok) {
			return err(result.error);
		}

		try {
			const data = await result.value.json();
			return ok({
				taskId: data.taskId,
				message: data.message,
				queueStatus: data.queueStatus,
				mode: 'queued'
			});
		} catch {
			return err(ApiErrors.network('Failed to parse queue response'));
		}
	}

	if (!book.downloadRef) {
		return err(ApiErrors.validation('Selected provider does not expose a downloadable file'));
	}

	const request = toSearchQueueRequest(book);
	if (!request.ok) {
		return request;
	}

	const result = await post(ZUIRoutes.searchQueue, JSON.stringify(request.value));
	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data = await result.value.json();
		return ok({
			taskId: data.taskId,
			message: data.message,
			queueStatus: data.queueStatus,
			mode: 'queued'
		});
	} catch {
		return err(ApiErrors.network('Failed to parse provider queue response'));
	}
}
