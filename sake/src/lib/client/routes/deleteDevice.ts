import { type Result, err, ok } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { DeleteDeviceResponse } from '$lib/types/Auth/Device';
import { ZUIRoutes } from '../base/routes';

export async function deleteDevice(deviceId: string): Promise<Result<DeleteDeviceResponse, ApiError>> {
	try {
		const response = await fetch(`/api${ZUIRoutes.devices}/${encodeURIComponent(deviceId)}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok((await response.json()) as DeleteDeviceResponse);
	} catch (error) {
		return err(ApiErrors.network('Failed to delete device', error));
	}
}
