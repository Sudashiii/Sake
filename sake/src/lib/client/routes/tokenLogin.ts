import { type Result, ok, err } from '$lib/types/Result';
import type { ApiError } from '$lib/types/ApiError';
import type { ZTokenLoginRequest } from '$lib/types/ZLibrary/Requests/ZTokenLoginRequest';
import { post } from '../base/post';
import { ZUIRoutes } from '../base/routes';

export async function tokenLogin(request: ZTokenLoginRequest): Promise<Result<void, ApiError>> {
	const result = await post(ZUIRoutes.tokenLogin, JSON.stringify(request));

	if (!result.ok) {
		return err(result.error);
	}

	return ok(undefined);
}
