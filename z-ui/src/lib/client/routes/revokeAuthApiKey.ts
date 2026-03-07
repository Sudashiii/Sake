import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import { ZUIRoutes } from '../base/routes';

export async function revokeAuthApiKey(apiKeyId: number): Promise<Result<void, ApiError>> {
	try {
		const response = await fetch(`/api${ZUIRoutes.authApiKeys}/${apiKeyId}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok(undefined);
	} catch (error) {
		return err(ApiErrors.network('Failed to revoke API key', error));
	}
}
