import { type Result, err, ok } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
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

	const downloadResponse = await post(
		ZUIRoutes.searchDownload,
		JSON.stringify({
			provider: book.provider,
			downloadRef: book.downloadRef,
			title: book.title,
			extension: book.extension ?? null
		})
	);
	if (!downloadResponse.ok) {
		return err(downloadResponse.error);
	}

	try {
		const fileBuffer = await downloadResponse.value.arrayBuffer();
		const fallbackExtension = (book.extension ?? 'epub').toLowerCase();
		const fileName = `${book.title.trim() || 'book'}.${fallbackExtension}`;

		const uploadResponse = await fetch(`/api/library/${encodeURIComponent(fileName)}`, {
			method: 'PUT',
			headers: {
				'Content-Type': downloadResponse.value.headers.get('content-type') || 'application/octet-stream'
			},
			body: fileBuffer
		});

		if (!uploadResponse.ok) {
			return err(await ApiErrors.fromResponse(uploadResponse));
		}

		return ok({
			taskId: null,
			message: 'Book imported to library',
			queueStatus: { pending: 0, processing: 0 },
			mode: 'imported'
		});
	} catch (cause: unknown) {
		return err(ApiErrors.network('Failed to import provider book into library', cause));
	}
}
