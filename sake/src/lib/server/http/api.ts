import { json } from '@sveltejs/kit';
import { ok, err, type Result } from '$lib/types/Result';

export interface ApiFailure {
	message: string;
	status: number;
	cause?: unknown;
}

export type ApiResult<T> = Result<T, ApiFailure>;

export function apiOk<T>(value: T): ApiResult<T> {
	return ok(value);
}

export function apiError(message: string, status = 500, cause?: unknown): ApiResult<never> {
	return err({ message, status, cause });
}

export function errorResponse(message: string, status = 500): Response {
	return json({ error: message }, { status });
}

export function getErrorMessage(cause: unknown, fallback: string): string {
	if (cause instanceof Error && cause.message) {
		return cause.message;
	}
	if (typeof cause === 'string' && cause.length > 0) {
		return cause;
	}
	return fallback;
}

export async function attempt<T>(
	fn: () => Promise<T>,
	fallbackMessage: string,
	status = 500
): Promise<ApiResult<T>> {
	try {
		return apiOk(await fn());
	} catch (cause) {
		return apiError(getErrorMessage(cause, fallbackMessage), status, cause);
	}
}
