import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';

export async function downloadLibraryBookFile(
	storageKey: string,
	fileName: string
): Promise<Result<void, ApiError>> {
	try {
		const response = await fetch(`/api/library/${encodeURIComponent(storageKey)}`, {
			method: 'GET'
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		const blob = await response.blob();
		const url = window.URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = fileName;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		window.URL.revokeObjectURL(url);

		return ok(undefined);
	} catch (error) {
		return err(ApiErrors.network('Failed to download library file', error));
	}
}
