import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { CurrentUserResponse } from '$lib/types/Auth/CurrentUser';
import { ZUIRoutes } from '../base/routes';

interface BootstrapLocalAccountRequest {
	username: string;
	password: string;
}

export async function bootstrapLocalAccount(
	request: BootstrapLocalAccountRequest
): Promise<Result<CurrentUserResponse, ApiError>> {
	try {
		const response = await fetch('/api' + ZUIRoutes.authBootstrap, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(request)
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as CurrentUserResponse);
	} catch (error) {
		return err(ApiErrors.network('Failed to create the first account', error));
	}
}
