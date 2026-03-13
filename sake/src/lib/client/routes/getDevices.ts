import { type Result, err, ok } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { DevicesResponse } from '$lib/types/Auth/Device';
import { ZUIRoutes } from '../base/routes';

export async function getDevices(): Promise<Result<DevicesResponse, ApiError>> {
	try {
		const response = await fetch('/api' + ZUIRoutes.devices, {
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as DevicesResponse);
	} catch (error) {
		return err(ApiErrors.network('Failed to fetch devices', error));
	}
}
