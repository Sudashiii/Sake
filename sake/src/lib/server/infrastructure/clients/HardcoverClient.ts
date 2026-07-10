const HARDCOVER_API_URL = 'https://api.hardcover.app/v1/graphql';
const UPSTREAM_TIMEOUT_MS = 30_000;
const USER_AGENT = 'Sake/1.0 (+https://github.com/Sudashiii/Sake)';
const RATE_LIMIT_INTERVAL_MS = 1_000;

import {
	ExternalClientError,
	parseExternalJson,
	requestExternal,
	type ExternalClientErrorKind
} from './externalClientPolicy';

export type HardcoverClientErrorKind = ExternalClientErrorKind;

export class HardcoverClientError extends ExternalClientError {
	constructor(
		message: string,
		readonly status: number,
		readonly isRetryable: boolean,
		readonly kind: HardcoverClientErrorKind = 'upstream'
	) {
		super(message, status, isRetryable, kind);
		this.name = 'HardcoverClientError';
	}
}

export class HardcoverClient {
	private nextAllowedAt = 0;

	constructor(
		private readonly apiToken: string,
		private readonly fetchFn: typeof fetch = fetch
	) {}

	async execute<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
		const waitMs = Math.max(0, this.nextAllowedAt - Date.now());
		if (waitMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, waitMs));
		}
		this.nextAllowedAt = Date.now() + RATE_LIMIT_INTERVAL_MS;

		try {
			const response = await requestExternal(this.fetchFn, HARDCOVER_API_URL, {
				method: 'POST',
				timeoutMs: UPSTREAM_TIMEOUT_MS,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiToken}`,
					'User-Agent': USER_AGENT
				},
				body: JSON.stringify({ query, variables })
			});

			const payload = await parseExternalJson(response, (value): value is {
				data?: T;
				errors?: Array<{ message?: string }>;
			} => typeof value === 'object' && value !== null &&
				('data' in value || 'errors' in value));
			if (payload.errors?.length) {
				const message = payload.errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ');
				throw new HardcoverClientError(
					message,
					502,
					/timeout|rate|temporar/i.test(message),
					'graphql'
				);
			}
			if (payload.data === undefined) {
				throw new HardcoverClientError('Hardcover API returned no data', 502, true, 'invalid_response');
			}
			return payload.data;
		} catch (cause: unknown) {
			if (cause instanceof HardcoverClientError) {
				throw cause;
			}
			if (cause instanceof ExternalClientError) {
				throw new HardcoverClientError(cause.message, cause.status, cause.isRetryable, cause.kind);
			}
			throw new HardcoverClientError('Hardcover request failed', 502, true, 'network');
		}
	}
}
