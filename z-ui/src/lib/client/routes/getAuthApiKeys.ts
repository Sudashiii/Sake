import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { AuthApiKeysResponse } from '$lib/types/Auth/ApiKey';
import { ZUIRoutes } from '../base/routes';

export async function getAuthApiKeys(): Promise<Result<AuthApiKeysResponse, ApiError>> {
	try {
		const response = await fetch('/api' + ZUIRoutes.authApiKeys, {
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as AuthApiKeysResponse);
	} catch (error) {
		return err(ApiErrors.network('Failed to fetch API keys', error));
	}
}
