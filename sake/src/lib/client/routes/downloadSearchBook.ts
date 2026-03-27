import { type Result, err, ok } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { SearchResultBook } from '$lib/types/Search/SearchResultBook';
import type { ZDownloadBookRequest } from '$lib/types/ZLibrary/Requests/ZDownloadBookRequest';
import { post } from '../base/post';
import { ZUIRoutes } from '../base/routes';

function toZLibraryDownloadRequest(
	book: SearchResultBook,
	downloadToDevice: boolean | undefined
): Result<ZDownloadBookRequest, ApiError> {
	if (book.provider !== 'zlibrary') {
		return err(ApiErrors.validation('Selected provider does not support download'));
	}
	if (!book.downloadRef) {
		return err(ApiErrors.validation('Missing download reference for selected book'));
	}

	return ok({
		bookId: book.providerBookId,
		hash: book.downloadRef,
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
		downloadToDevice
	});
}

export async function downloadSearchBook(
	book: SearchResultBook,
	options: { downloadToDevice?: boolean } = {}
): Promise<Result<void, ApiError>> {
	let result: Result<Response, ApiError>;
	if (book.provider === 'zlibrary') {
		const request = toZLibraryDownloadRequest(book, options.downloadToDevice);
		if (!request.ok) {
			return request;
		}
		result = await post(ZUIRoutes.downloadBook, JSON.stringify(request.value));
	} else {
		if (!book.downloadRef) {
			return err(ApiErrors.validation('Selected provider does not expose a downloadable file'));
		}
		result = await post(
			ZUIRoutes.searchDownload,
			JSON.stringify({
				provider: book.provider,
				downloadRef: book.downloadRef,
				title: book.title,
				extension: book.extension ?? null
			})
		);
	}

	if (!result.ok) {
		return err(result.error);
	}

	try {
		if (options.downloadToDevice === false) {
			return ok(undefined);
		}

		const blob = await result.value.blob();
		const url = window.URL.createObjectURL(blob);

		const extension = (book.extension ?? 'epub').toLowerCase();
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `${book.title}.${extension}`;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();

		window.URL.revokeObjectURL(url);
		return ok(undefined);
	} catch {
		return err(ApiErrors.network('Failed to process download'));
	}
}
