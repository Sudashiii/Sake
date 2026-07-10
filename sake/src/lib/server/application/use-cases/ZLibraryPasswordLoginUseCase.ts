import type { ZLibraryPort } from '$lib/server/application/ports/ZLibraryPort';
import type { ApiResult } from '$lib/server/http/api';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';

export interface ZLibraryPasswordLoginInput {
	email: string;
	password: string;
}

export class ZLibraryPasswordLoginUseCase {
	constructor(private readonly zlibrary: ZLibraryPort) {}

	async execute(request: ZLibraryPasswordLoginInput): Promise<ApiResult<ZLoginResponse>> {
		return this.zlibrary.passwordLogin(request.email, request.password);
	}
}
