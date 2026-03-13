import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface DeleteLibraryFileResult {
	success: true;
	deleted: string;
}

export class DeleteLibraryFileUseCase {
	constructor(private readonly storage: StoragePort) {}

	async execute(title: string): Promise<ApiResult<DeleteLibraryFileResult>> {
		const key = `library/${title}`;
		await this.storage.delete(key);
		return apiOk({
			success: true,
			deleted: key
		});
	}
}
