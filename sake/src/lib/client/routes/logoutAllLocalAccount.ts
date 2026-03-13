import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { ZUIRoutes } from '../base/routes';

export async function logoutAllLocalAccount(): Promise<Result<void, ApiError>> {
	try {
		const response = await fetch('/api' + ZUIRoutes.authLogoutAll, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok(undefined);
	} catch (error) {
		return err(ApiErrors.network('Failed to log out all sessions', error));
	}
}
