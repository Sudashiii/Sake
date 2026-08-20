import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ApiErrors } from '$lib/types/ApiError';

describe('ApiErrors.fromResponse', () => {
	test('preserves a structured API error message', async () => {
		const error = await ApiErrors.fromResponse(
			new Response(JSON.stringify({ error: 'Incorrect credentials' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		assert.equal(error.type, 'authentication');
		assert.equal(error.message, 'Incorrect credentials');
	});

	test('does not expose an HTML gateway response to users', async () => {
		const error = await ApiErrors.fromResponse(
			new Response('<!doctype html><title>502 Bad Gateway</title>', { status: 502 })
		);

		assert.equal(error.type, 'server');
		assert.equal(error.message, 'The service is temporarily unavailable. Please try again shortly.');
	});
});
