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

	test('retries a self-redirect once with its challenge cookie', async () => {
		const requests: RequestInit[] = [];
		const client = new ZLibraryClient('https://z.example', async (_input, init) => {
			requests.push(init ?? {});
			if (requests.length === 1) {
				return new Response(null, {
					status: 307,
					headers: {
						location: 'https://z.example/eapi/user/login',
						'set-cookie': '__challenge=accepted; Path=/; Secure'
					}
				});
			}

			return new Response(JSON.stringify({ success: 1, user: { id: '1', name: 'Reader' } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});

		const result = await client.passwordLogin('reader@example.com', 'password');

		assert.equal(result.ok, true);
		assert.equal(requests.length, 2);
		assert.equal(new Headers(requests[0]?.headers).get('Cookie'), null);
		assert.equal(new Headers(requests[1]?.headers).get('Cookie'), '__challenge=accepted');
		assert.equal(requests[0]?.redirect, 'manual');
	});

	test('reports an unresolved redirect as a gateway error', async () => {
		const client = new ZLibraryClient('https://z.example', async () =>
			new Response(null, {
				status: 307,
				headers: { location: 'https://another.example/login' }
			})
		);
		const result = await client.search({ searchText: 'book' });

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.error.status, 502);
	});
});
