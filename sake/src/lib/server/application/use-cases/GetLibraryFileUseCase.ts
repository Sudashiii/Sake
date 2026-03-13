import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { mimeTypes } from '$lib/server/constants/mimeTypes';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

interface GetLibraryFileResult {
	data: ArrayBuffer;
	contentType: string;
	contentLength: string;
}

export class GetLibraryFileUseCase {
	constructor(private readonly storage: StoragePort) {}

	async execute(title: string): Promise<ApiResult<GetLibraryFileResult>> {
		const key = `library/${title}`;
		const extension = key.split('.').pop()?.toLowerCase() || 'default';
		const contentType = mimeTypes[extension] || mimeTypes.default;

		try {
			const data = await this.storage.get(key);
			const arrayBuffer = data.buffer.slice(
				data.byteOffset,
				data.byteOffset + data.byteLength
			) as ArrayBuffer;

			return apiOk({
				data: arrayBuffer,
				contentType,
				contentLength: data.length.toString()
			});
		} catch (cause) {
			return apiError('File not found', 404, cause);
		}
	}
}
