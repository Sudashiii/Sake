export type ExternalClientErrorKind =
	| 'timeout'
	| 'rate_limit'
	| 'authentication'
	| 'invalid_response'
	| 'upstream'
	| 'network'
	| 'graphql'
	| 'mutation'
	| 'configuration';

export class ExternalClientError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly isRetryable: boolean,
		readonly kind: ExternalClientErrorKind = 'upstream'
	) {
		super(message);
		this.name = 'ExternalClientError';
	}
}

export interface ExternalRequestOptions extends RequestInit {
	timeoutMs: number;
}

export async function requestExternal(
	fetchFn: typeof fetch,
	input: RequestInfo | URL,
	options: ExternalRequestOptions
): Promise<Response> {
	const controller = new AbortController();
	const { timeoutMs, ...requestInit } = options;
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetchFn(input, { ...requestInit, signal: controller.signal });
		if (!response.ok) {
			throw new ExternalClientError(
				`External API returned HTTP ${response.status}`,
				response.status,
				response.status === 429 || response.status >= 500,
				classifyStatus(response.status)
			);
		}
		return response;
	} catch (cause: unknown) {
		if (cause instanceof ExternalClientError) {
			throw cause;
		}
		if (cause instanceof Error && cause.name === 'AbortError') {
			throw new ExternalClientError('External request timed out', 504, true, 'timeout');
		}
		throw new ExternalClientError('External request failed', 502, true, 'network');
	} finally {
		clearTimeout(timer);
	}
}

export async function parseExternalJson<T>(
	response: Response,
	validate: (value: unknown) => value is T,
	maxBytes = 1_048_576
): Promise<T> {
	const body = await response.text();
	if (new TextEncoder().encode(body).byteLength > maxBytes) {
		throw new ExternalClientError('External API response was too large', 502, false, 'invalid_response');
	}

	let value: unknown;
	try {
		value = JSON.parse(body) as unknown;
	} catch {
		throw new ExternalClientError('External API returned invalid JSON', 502, false, 'invalid_response');
	}
	if (!validate(value)) {
		throw new ExternalClientError('External API returned an invalid response', 502, false, 'invalid_response');
	}
	return value;
}

function classifyStatus(status: number): ExternalClientErrorKind {
	if (status === 401 || status === 403) return 'authentication';
	if (status === 429) return 'rate_limit';
	return 'upstream';
}
