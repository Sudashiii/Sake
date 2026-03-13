import { apiOk, type ApiResult } from '$lib/server/http/api';

interface ZLibraryLogoutResult {
	success: true;
}

export class ZLibraryLogoutUseCase {
	async execute(): Promise<ApiResult<ZLibraryLogoutResult>> {
		return apiOk({ success: true });
	}
}
