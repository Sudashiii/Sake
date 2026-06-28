const HARDCOVER_API_URL = 'https://api.hardcover.app/v1/graphql';
const UPSTREAM_TIMEOUT_MS = 30_000;
const USER_AGENT = 'Sake/1.0 (+https://github.com/Sudashiii/Sake)';
const RATE_LIMIT_INTERVAL_MS = 1_000;

export type HardcoverClientErrorKind =
	| 'authentication'
	| 'rate-limit'
	| 'upstream'
	| 'graphql'
	| 'timeout'
	| 'network'
	| 'invalid-response'
	| 'mutation'
	| 'configuration';

export class HardcoverClientError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly isRetryable: boolean,
		readonly kind: HardcoverClientErrorKind = 'upstream'
	) {
		super(message);
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

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
		try {
			const response = await this.fetchFn(HARDCOVER_API_URL, {
				method: 'POST',
				signal: controller.signal,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiToken}`,
					'User-Agent': USER_AGENT
				},
				body: JSON.stringify({ query, variables })
			});

			if (!response.ok) {
				const kind: HardcoverClientErrorKind =
					response.status === 401 || response.status === 403
						? 'authentication'
						: response.status === 429
							? 'rate-limit'
							: 'upstream';
				throw new HardcoverClientError(
					`Hardcover API returned HTTP ${response.status}`,
					response.status,
					response.status === 429 || response.status >= 500,
					kind
				);
			}

			const payload = (await response.json()) as {
				data?: T;
				errors?: Array<{ message?: string }>;
			};
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
				throw new HardcoverClientError('Hardcover API returned no data', 502, true, 'invalid-response');
			}
			return payload.data;
		} catch (cause: unknown) {
			if (cause instanceof HardcoverClientError) {
				throw cause;
			}
			if (cause instanceof Error && cause.name === 'AbortError') {
				throw new HardcoverClientError('Hardcover request timed out', 504, true, 'timeout');
			}
			throw new HardcoverClientError('Hardcover request failed', 502, true, 'network');
		} finally {
			clearTimeout(timer);
		}
	}
}
