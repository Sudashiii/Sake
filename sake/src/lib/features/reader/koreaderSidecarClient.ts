import {
	mergeKoreaderSidecar,
	parseKoreaderSidecar,
	koreaderDateTime,
	koreaderLocalDate,
	type SidecarChanges,
	type SidecarSnapshot
} from '$lib/koreader/koreaderSidecar';

export { koreaderDateTime };

async function responseError(response: Response, fallback: string): Promise<Error> {
	try {
		const body = (await response.json()) as { error?: unknown };
		if (typeof body.error === 'string' && body.error.length > 0) {
			return new Error(body.error);
		}
	} catch {
		// The existing progress endpoint may return a plain response.
	}
	return new Error(fallback);
}

export async function fetchKoreaderSidecar(fileName: string): Promise<SidecarSnapshot | null> {
	const response = await fetch(
		`/api/library/progress?fileName=${encodeURIComponent(fileName)}`,
		{ headers: { Accept: 'application/x-lua' } }
	);
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw await responseError(response, 'Failed to load KOReader reading state');
	}
	return parseKoreaderSidecar(await response.text());
}

export async function saveKoreaderSidecar(
	fileName: string,
	changes: SidecarChanges,
	readerSessionId?: string
): Promise<SidecarSnapshot> {
	const latest = await fetchKoreaderSidecar(fileName);
	const merged = mergeKoreaderSidecar(latest?.source ?? null, changes, koreaderLocalDate());
	const formData = new FormData();
	formData.set('fileName', fileName);
	formData.set(
		'file',
		new File([merged.source], 'metadata.epub.lua', { type: 'application/x-lua' })
	);
	formData.set('percentFinished', String(merged.percentFinished));
	if (readerSessionId) {
		formData.set('readerSessionId', readerSessionId);
	}

	const response = await fetch('/api/library/progress', {
		method: 'PUT',
		body: formData
	});
	if (!response.ok) {
		throw await responseError(response, 'Failed to save KOReader reading state');
	}
	return merged;
}
