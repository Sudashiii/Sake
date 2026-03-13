import type { ZLibraryPort } from '$lib/server/application/ports/ZLibraryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { ZTokenLoginRequest } from '$lib/types/ZLibrary/Requests/ZTokenLoginRequest';

interface ZLibraryTokenLoginResult {
	success: true;
	userId: string;
	userKey: string;
}

export class ZLibraryTokenLoginUseCase {
	constructor(private readonly zlibrary: ZLibraryPort) {}

	async execute(request: ZTokenLoginRequest): Promise<ApiResult<ZLibraryTokenLoginResult>> {
		const loginResult = await this.zlibrary.tokenLogin(request.userId, request.userKey);
		if (!loginResult.ok) {
			return loginResult;
		}

		return apiOk({
			success: true,
			userId: request.userId,
			userKey: request.userKey
		});
	}
}
