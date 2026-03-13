import type { ZLibraryPort } from '$lib/server/application/ports/ZLibraryPort';
import type { ApiResult } from '$lib/server/http/api';
import type { ZLoginRequest } from '$lib/types/ZLibrary/Requests/ZLoginRequest';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';

export class ZLibraryPasswordLoginUseCase {
	constructor(private readonly zlibrary: ZLibraryPort) {}

	async execute(request: ZLoginRequest): Promise<ApiResult<ZLoginResponse>> {
		return this.zlibrary.passwordLogin(request.email, request.password);
	}
}
