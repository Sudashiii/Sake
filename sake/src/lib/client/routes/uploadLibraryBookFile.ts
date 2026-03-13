import { type Result, err, ok } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

export async function uploadLibraryBookFile(file: File): Promise<Result<void, ApiError>> {
	const fileName = file.name?.trim();
	if (!fileName) {
		return err(ApiErrors.validation('File name is missing'));
	}

	try {
		const response = await fetch(`/api/library/${encodeURIComponent(fileName)}`, {
			method: 'PUT',
			headers: {
				'Content-Type': file.type || 'application/octet-stream'
			},
			body: await file.arrayBuffer()
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		return ok(undefined);
	} catch (error) {
		return err(ApiErrors.network('Failed to upload library file', error));
	}
}
