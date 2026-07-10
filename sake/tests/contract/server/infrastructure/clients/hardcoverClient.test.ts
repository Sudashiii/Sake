import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	HardcoverClient,
	HardcoverClientError
} from '$lib/server/infrastructure/clients/HardcoverClient';

describe('HardcoverClient', () => {
	test('sends authenticated GraphQL requests and returns data', async () => {
		let authorization = '';
		const client = new HardcoverClient('test-token', async (_input, init) => {
			authorization = new Headers(init?.headers).get('authorization') ?? '';
			return Response.json({ data: { books_by_pk: { id: 42 } } });
		});
		const result = await client.execute<{ books_by_pk: { id: number } }>('query Test { books_by_pk(id: 42) { id } }');
		assert.equal(authorization, 'Bearer test-token');
		assert.equal(result.books_by_pk.id, 42);
	});

	test('classifies upstream throttling as retryable', async () => {
		const client = new HardcoverClient('test-token', async () => new Response(null, { status: 429 }));
		await assert.rejects(
			() => client.execute('query Test { __typename }'),
			(error: unknown) =>
				error instanceof HardcoverClientError &&
				error.status === 429 &&
				error.kind === 'rate-limit' &&
				error.isRetryable
		);
	});

	test('classifies authentication failures without exposing the token', async () => {
		const client = new HardcoverClient('secret-token', async () => new Response(null, { status: 401 }));
		await assert.rejects(
			() => client.execute('query Test { __typename }'),
			(error: unknown) =>
				error instanceof HardcoverClientError &&
				error.kind === 'authentication' &&
				!error.message.includes('secret-token') &&
				!error.isRetryable
		);
	});

	test('surfaces GraphQL errors without exposing response internals', async () => {
		const client = new HardcoverClient('test-token', async () =>
			Response.json({ errors: [{ message: 'permission denied' }] })
		);
		await assert.rejects(
			() => client.execute('mutation Test { __typename }'),
			(error: unknown) =>
				error instanceof HardcoverClientError &&
				error.message === 'permission denied' &&
				error.kind === 'graphql' &&
				!error.isRetryable
		);
	});

	test('classifies aborted requests as retryable timeouts', async () => {
		const client = new HardcoverClient('test-token', async () => {
			throw new DOMException('aborted', 'AbortError');
		});
		await assert.rejects(
			() => client.execute('query Test { __typename }'),
			(error: unknown) =>
				error instanceof HardcoverClientError &&
				error.kind === 'timeout' &&
				error.isRetryable
		);
	});
});
