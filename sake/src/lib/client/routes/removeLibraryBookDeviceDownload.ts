import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

export async function removeLibraryBookDeviceDownload(
	bookId: number,
	deviceId: string
): Promise<Result<void, ApiError>> {
	try {
		const res = await fetch(`/api/library/${bookId}/downloads/${encodeURIComponent(deviceId)}`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!res.ok) {
			return err(await ApiErrors.fromResponse(res));
		}

		return ok(undefined);
	} catch (error) {
		return err(ApiErrors.network('Network request failed', error));
	}
}
