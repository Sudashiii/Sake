import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ExternalClientError } from '$lib/server/infrastructure/clients/externalClientPolicy';
import { ZLibraryClient } from '$lib/server/infrastructure/clients/ZLibraryClient';

describe('ZLibraryClient', () => {
	test('classifies authentication responses without retrying', async () => {
		const client = new ZLibraryClient('https://z.example', async () => new Response(null, { status: 401 }));
		const result = await client.search({ searchText: 'book' });

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.error.status, 401);
		assert.ok(result.error.cause instanceof ExternalClientError);
		assert.equal(result.error.cause.kind, 'authentication');
		assert.equal(result.error.cause.isRetryable, false);
	});

	test('rejects malformed JSON as a non-retryable invalid response', async () => {
		const client = new ZLibraryClient('https://z.example', async () =>
			new Response('{not-json', { status: 200, headers: { 'Content-Type': 'application/json' } })
		);
		const result = await client.search({ searchText: 'book' });

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.ok(result.error.cause instanceof ExternalClientError);
		assert.equal(result.error.cause.kind, 'invalid_response');
		assert.equal(result.error.cause.isRetryable, false);
	});

	test('classifies aborted requests as retryable timeouts', async () => {
		const client = new ZLibraryClient('https://z.example', async () => {
			throw new DOMException('aborted', 'AbortError');
		});
		const result = await client.search({ searchText: 'book' });

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.ok(result.error.cause instanceof ExternalClientError);
		assert.equal(result.error.cause.kind, 'timeout');
		assert.equal(result.error.cause.isRetryable, true);
	});
});
