import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { AuthStatus } from '$lib/types/Auth/AuthStatus';
import { ZUIRoutes } from '../base/routes';

export async function getAuthStatus(): Promise<Result<AuthStatus, ApiError>> {
	try {
		const response = await fetch('/api' + ZUIRoutes.authStatus, {
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as AuthStatus);
	} catch (error) {
		return err(ApiErrors.network('Failed to fetch authentication status', error));
	}
}
