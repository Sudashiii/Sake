import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { CurrentUserResponse } from '$lib/types/Auth/CurrentUser';
import { ZUIRoutes } from '../base/routes';

export async function getCurrentUser(): Promise<Result<CurrentUserResponse, ApiError>> {
	try {
		const response = await fetch('/api' + ZUIRoutes.authMe, {
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as CurrentUserResponse);
	} catch (error) {
		return err(ApiErrors.network('Failed to fetch current user', error));
	}
}
