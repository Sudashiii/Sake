import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isApiKeyAllowedRoute } from '$lib/server/auth/requestAccess';

describe('requestAccess', () => {
	test('allows API keys to fetch managed library covers', () => {
		assert.equal(isApiKeyAllowedRoute('/api/library/covers/example.epub.jpg', 'GET'), true);
	});

	test('still blocks non-GET access to managed library covers', () => {
		assert.equal(isApiKeyAllowedRoute('/api/library/covers/example.epub.jpg', 'POST'), false);
	});
});
