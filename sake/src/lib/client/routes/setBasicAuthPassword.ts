import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { BasicAuthPasswordResponse } from '$lib/types/Auth/BasicAuthPassword';
import { ZUIRoutes } from '../base/routes';

export async function setBasicAuthPassword(
	password: string
): Promise<Result<BasicAuthPasswordResponse, ApiError>> {
	try {
		const response = await fetch('/api' + ZUIRoutes.authBasicPassword, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ password })
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as BasicAuthPasswordResponse);
	} catch (error) {
		return err(ApiErrors.network('Failed to set Basic authentication password', error));
	}
}
