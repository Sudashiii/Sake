import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import {
	buildManagedBookCoverStorageKey,
	isValidManagedBookCoverFileName
} from '$lib/server/application/services/ManagedBookCoverService';
import { mimeTypes } from '$lib/server/constants/mimeTypes';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface GetLibraryCoverResult {
	data: ArrayBuffer;
	contentType: string;
	contentLength: string;
	cacheControl: string;
}

export class GetLibraryCoverUseCase {
	constructor(private readonly storage: StoragePort) {}

	async execute(fileName: string): Promise<ApiResult<GetLibraryCoverResult>> {
		const normalizedFileName = fileName.trim();
		if (!normalizedFileName || !isValidManagedBookCoverFileName(normalizedFileName)) {
			return apiError('Cover not found', 404);
		}

		const extension = normalizedFileName.split('.').pop()?.toLowerCase() || 'default';
		const contentType = mimeTypes[extension] || mimeTypes.default;

		try {
			const data = await this.storage.get(buildManagedBookCoverStorageKey(normalizedFileName));
			const arrayBuffer = data.buffer.slice(
				data.byteOffset,
				data.byteOffset + data.byteLength
			) as ArrayBuffer;

			return apiOk({
				data: arrayBuffer,
				contentType,
				contentLength: data.length.toString(),
				cacheControl: 'private, max-age=86400'
			});
		} catch (cause) {
			return apiError('Cover not found', 404, cause);
		}
	}
}
