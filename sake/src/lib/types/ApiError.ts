/**
 * Structured error types for API operations.
 */

export type ApiError =
	| AuthenticationError
	| NetworkError
	| ValidationError
	| NotFoundError
	| ServerError;

export interface AuthenticationError {
	readonly type: 'authentication';
	readonly message: string;
}

export interface NetworkError {
	readonly type: 'network';
	readonly message: string;
	readonly cause?: unknown;
}

export interface ValidationError {
	readonly type: 'validation';
	readonly message: string;
	readonly fields?: Record<string, string>;
}

export interface NotFoundError {
	readonly type: 'not_found';
	readonly message: string;
	readonly resource?: string;
}

export interface ServerError {
	readonly type: 'server';
	readonly message: string;
	readonly status: number;
}

/**
 * Factory functions for creating specific error types.
 */
export const ApiErrors = {
	authentication: (message: string): AuthenticationError => ({
		type: 'authentication',
		message
	}),

	network: (message: string, cause?: unknown): NetworkError => ({
		type: 'network',
		message,
		cause
	}),

	validation: (message: string, fields?: Record<string, string>): ValidationError => ({
		type: 'validation',
		message,
		fields
	}),

	notFound: (message: string, resource?: string): NotFoundError => ({
		type: 'not_found',
		message,
		resource
	}),

	server: (message: string, status: number): ServerError => ({
		type: 'server',
		message,
		status
	}),

	fromResponse: async (response: Response): Promise<ApiError> => {
		const text = await response.text().catch(() => 'Unknown error');
		let message = text || 'Unknown error';

		if (text) {
			try {
				const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
				if (typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
					message = parsed.error;
				} else if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
					message = parsed.message;
				}
			} catch {
				message = text;
			}
		}

		if (response.status === 401 || response.status === 403) {
			return ApiErrors.authentication(message || 'Authentication failed');
		}

		if (response.status === 404) {
			return ApiErrors.notFound(message || 'Resource not found');
		}

		if (response.status === 422 || response.status === 400) {
			return ApiErrors.validation(message || 'Validation failed');
		}

		return ApiErrors.server(message || `Request failed with status ${response.status}`, response.status);
	}
} as const;
