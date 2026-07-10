import type { ZLibraryCredentials, ZLibraryPort, ZLibrarySearchRequest } from '$lib/server/application/ports/ZLibraryPort';
import type { ApiResult } from '$lib/server/http/api';
import type { ZSearchBookResponse } from '$lib/types/ZLibrary/Responses/ZSearchBookResponse';

interface ZLibrarySearchInput {
	request: ZLibrarySearchRequest;
	credentials: ZLibraryCredentials;
}

export class ZLibrarySearchUseCase {
	constructor(private readonly zlibrary: ZLibraryPort) {}

	async execute(input: ZLibrarySearchInput): Promise<ApiResult<ZSearchBookResponse>> {
		const loginResult = await this.zlibrary.tokenLogin(
			input.credentials.userId,
			input.credentials.userKey
		);
		if (!loginResult.ok) {
			return loginResult;
		}

		return this.zlibrary.search(input.request);
	}
}
