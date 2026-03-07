import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

export async function post(endpoint: string, body: string): Promise<Result<Response, ApiError>> {
	try {
		const res = await fetch('/api' + endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: body
		});

		if (!res.ok) {
			return err(await ApiErrors.fromResponse(res));
		}

		return ok(res);
	} catch (error) {
		return err(ApiErrors.network('Network request failed', error));
	}
}
