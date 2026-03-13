import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { ZLoginRequest } from '$lib/types/ZLibrary/Requests/ZLoginRequest';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';
import { post } from '../base/post';
import { ZUIRoutes } from '../base/routes';

export async function passwordLogin(
	request: ZLoginRequest
): Promise<Result<ZLoginResponse, ApiError>> {
	const result = await post(ZUIRoutes.passwordLogin, JSON.stringify(request));

	if (!result.ok) {
		return err(result.error);
	}

	try {
		const data: ZLoginResponse = await result.value.json();
		return ok(data);
	} catch {
		return err(ApiErrors.server('Failed to parse login response', 500));
	}
}
