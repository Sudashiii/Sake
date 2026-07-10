import type { ZLibraryPort } from '$lib/server/application/ports/ZLibraryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';

export interface ZLibraryTokenLoginInput {
	userId: string;
	userKey: string;
}

interface ZLibraryTokenLoginResult {
	success: true;
	userId: string;
	userKey: string;
}

export class ZLibraryTokenLoginUseCase {
	constructor(private readonly zlibrary: ZLibraryPort) {}

	async execute(request: ZLibraryTokenLoginInput): Promise<ApiResult<ZLibraryTokenLoginResult>> {
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
