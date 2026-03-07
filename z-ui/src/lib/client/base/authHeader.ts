import { type Result, ok } from '$lib/types/Result';
import type { AuthenticationError } from '$lib/types/ApiError';

export function generateAuthHeader(): Result<string, AuthenticationError> {
	return ok('');
}

export function getStoredCredentials(): { username: string; password: string } | null {
	return null;
}

export function storeCredentials(_username: string, _password: string): void {}

export function clearCredentials(): void {}
