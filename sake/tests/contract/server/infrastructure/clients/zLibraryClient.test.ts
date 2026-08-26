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

	test('fails over to the next configured mirror after a retryable failure', async () => {
		const requestedUrls: string[] = [];
		const client = new ZLibraryClient(
			async () => ['https://first.example', 'https://second.example'],
			async (input) => {
				const url = String(input);
				requestedUrls.push(url);
				if (url.startsWith('https://first.example')) return new Response(null, { status: 503 });
				return new Response(JSON.stringify({ success: 1, books: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		);

		const result = await client.search({ searchText: 'book' });

		assert.equal(result.ok, true);
		assert.deepEqual(requestedUrls, [
			'https://first.example/eapi/book/search',
			'https://second.example/eapi/book/search'
		]);
	});

	test('does not try another mirror after an authentication failure', async () => {
		let calls = 0;
		const client = new ZLibraryClient(
			async () => ['https://first.example', 'https://second.example'],
			async () => {
				calls += 1;
				return new Response(null, { status: 401 });
			}
		);

		const result = await client.search({ searchText: 'book' });

		assert.equal(result.ok, false);
		assert.equal(calls, 1);
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

	for (const redirectStatus of [302, 307, 308]) {
		test(`follows normal ${redirectStatus} download redirects`, async () => {
			const requests: Array<{ url: string; headers: Headers }> = [];
			const client = new ZLibraryClient('https://z.example', async (input, init) => {
				const url = String(input);
				requests.push({ url, headers: new Headers(init?.headers) });
				if (url.includes('/eapi/book/') && url.endsWith('/file')) {
					return new Response(
						JSON.stringify({ success: 1, file: { downloadLink: 'https://cdn.example/file' } }),
						{ status: 200, headers: { 'Content-Type': 'application/json' } }
					);
				}
				if (url === 'https://cdn.example/file') {
					return new Response(null, {
						status: redirectStatus,
						headers: { location: 'https://cdn.example/final-file' }
					});
				}
				return new Response('book bytes', { status: 200 });
			}, undefined);

			const result = await client.download('book-1', 'hash-1', {
				userId: 'user-1',
				userKey: 'key-1'
			});

			assert.equal(result.ok, true);
			if (!result.ok) return;
			assert.equal(await result.value.text(), 'book bytes');
			assert.equal(requests[1]?.headers.get('Cookie'), null);
			assert.equal(requests[2]?.headers.get('Cookie'), null);
		});
	}

	test('rejects HTTP download redirects without making the insecure request', async () => {
		const requestedUrls: string[] = [];
		const client = new ZLibraryClient('https://z.example', async (input) => {
			const url = String(input);
			requestedUrls.push(url);
			if (url.includes('/eapi/book/') && url.endsWith('/file')) {
				return new Response(
					JSON.stringify({ success: 1, file: { downloadLink: 'https://z.example/file' } }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			return new Response(null, { status: 302, headers: { location: 'http://cdn.example/file' } });
		});

		const result = await client.download('book-1', 'hash-1', { userId: 'user-1', userKey: 'key-1' });

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.error.status, 502);
		assert.deepEqual(requestedUrls, [
			'https://z.example/eapi/book/book-1/hash-1/file',
			'https://z.example/file'
		]);
	});

	test('returns the mirror that successfully handled a search after failover', async () => {
		const client = new ZLibraryClient(
			async () => ['https://first.example', 'https://second.example'],
			async (input) => {
				if (String(input).startsWith('https://first.example')) return new Response(null, { status: 503 });
				return new Response(JSON.stringify({ success: 1, books: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		);

		const result = await client.search({ searchText: 'book' });

		assert.equal(result.ok, true);
		if (result.ok) assert.equal(result.value.mirrorUrl, 'https://second.example');
	});

	test('rejects more than five mirrors before making an upstream request', async () => {
		let calls = 0;
		const client = new ZLibraryClient(
			async () => Array.from({ length: 6 }, (_, index) => `https://mirror-${index}.example`),
			async () => {
				calls += 1;
				return new Response(null, { status: 503 });
			}
		);

		const result = await client.search({ searchText: 'book' });

		assert.equal(result.ok, false);
		assert.equal(calls, 0);
	});

	test('stops failover when the shared deadline is exhausted', async () => {
		let now = 0;
		let calls = 0;
		const client = new ZLibraryClient(
			async () => ['https://first.example', 'https://second.example'],
			async () => {
				calls += 1;
				now = 90_001;
				return new Response(null, { status: 503 });
			},
			() => now
		);

		const result = await client.search({ searchText: 'book' });

		assert.equal(result.ok, false);
		assert.equal(calls, 1);
	});
});
