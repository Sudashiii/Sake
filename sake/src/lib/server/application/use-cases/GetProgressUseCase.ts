import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import {
	buildProgressLookupTitleCandidates,
	buildProgressFileDescriptor,
} from '$lib/server/domain/value-objects/ProgressFile';

interface GetProgressResult {
	data: ArrayBuffer;
	metadataFileName: string;
}

interface GetProgressInput {
	fileName: string;
}

export class GetProgressUseCase {
	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly storage: StoragePort
	) {}

	async execute(input: GetProgressInput): Promise<ApiResult<GetProgressResult>> {
		let descriptor;
		try {
			const lookupCandidates = buildProgressLookupTitleCandidates(input.fileName);
			let book: Awaited<ReturnType<BookRepositoryPort['getByStorageKey']>> = undefined;
			for (const candidate of lookupCandidates) {
				book = await this.bookRepository.getByStorageKey(candidate);
				if (book) {
					break;
				}
			}
			descriptor = buildProgressFileDescriptor(book ? book.s3_storage_key : input.fileName);
		} catch (cause) {
			return apiError('Invalid title format. Expected filename with extension.', 400, cause);
		}

		try {
			const key = `library/${descriptor.progressKey}`;
			const data = await this.storage.get(key);
			const arrayBuffer = data.buffer.slice(
				data.byteOffset,
				data.byteOffset + data.byteLength
			) as ArrayBuffer;
			return apiOk({
				data: arrayBuffer,
				metadataFileName: descriptor.metadataFileName
			});
		} catch (cause) {
			return apiError('Progress file not found', 404, cause);
		}
	}
}
