import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { mimeTypes } from '$lib/server/constants/mimeTypes';

export class DavUploadService {
	#libraryFolder = 'library';
	#storage: StoragePort;

	constructor(storage: StoragePort) {
		this.#storage = storage;
	}

	async upload(fileName: string, data: Buffer): Promise<void> {
		const extension = fileName.split('.').pop()?.toLowerCase() || 'default';
		const contentType: string = mimeTypes[extension] || mimeTypes.default;
		const key = `${this.#libraryFolder}/${fileName}`;
		await this.#storage.put(key, data, contentType);
	}
}
