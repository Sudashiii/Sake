import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { BasicAuthPasswordResponse } from '$lib/types/Auth/BasicAuthPassword';
import { ZUIRoutes } from '../base/routes';

export async function clearBasicAuthPassword(): Promise<Result<BasicAuthPasswordResponse, ApiError>> {
	try {
		const response = await fetch('/api' + ZUIRoutes.authBasicPassword, {
			method: 'DELETE'
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as BasicAuthPasswordResponse);
	} catch (error) {
		return err(ApiErrors.network('Failed to remove Basic authentication password', error));
	}
}
