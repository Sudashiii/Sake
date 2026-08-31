import {
	parseKoreaderSidecar,
	koreaderDateTime,
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
	readerSessionId: string
): Promise<SidecarSnapshot> {
	const response = await fetch('/api/library/progress/web', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ fileName, readerSessionId, ...changes })
	});
	if (!response.ok) {
		throw await responseError(response, 'Failed to save KOReader reading state');
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new Error('Web reader returned an invalid progress response');
	}
	if (
		typeof body !== 'object' ||
		body === null ||
		!('sidecar' in body) ||
		typeof body.sidecar !== 'object' ||
		body.sidecar === null ||
		!('source' in body.sidecar) ||
		typeof body.sidecar.source !== 'string'
	) {
		throw new Error('Web reader returned an invalid progress response');
	}

	return parseKoreaderSidecar(body.sidecar.source);
}
