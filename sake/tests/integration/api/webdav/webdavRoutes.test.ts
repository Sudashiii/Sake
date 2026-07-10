import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
// @ts-expect-error Bun's test-only mock API is available at runtime but excluded from the app tsconfig.
import { mock } from 'bun:test';
import { hashPassword } from '$lib/server/application/services/LocalAuthService';

const passwordHash = await hashPassword('dav-password');

mock.module('$lib/server/application/composition', () => ({
	userRepository: {
		getByUsername: async (username: string) =>
			username === 'reader'
				? { id: 1, username, passwordHash, basicAuthPasswordHash: null, isDisabled: false }
				: undefined
	},
	listDavDirectoryUseCase: {
		execute: async ({ path }: { path: string }) => ({ ok: true, value: { xml: `<path>${path}</path>` } })
	},
	getQueueStatusUseCase: { execute: async () => ({ ok: true, value: {} }) },
	queueDownloadUseCase: { execute: async () => ({ ok: true, value: {} }) }
}));

const { fallback } = await import('../../../../src/routes/api/dav/[...path]/+server');

function event(request: Request) {
	return { request, url: new URL(request.url), locals: { logger: undefined } } as never;
}

describe('WebDAV HTTP boundary', () => {
	test('requires Basic authentication for PROPFIND', async () => {
		const response = await fallback(
			event(new Request('http://localhost/api/dav/library', { method: 'PROPFIND' }))
		);
		assert.equal(response.status, 401);
		assert.equal(response.headers.get('www-authenticate'), 'Basic realm="WebDAV"');
	});

	test('rejects methods other than PROPFIND', async () => {
		const response = await fallback(event(new Request('http://localhost/api/dav/library')));
		assert.equal(response.status, 405);
		assert.deepEqual(await response.json(), { error: 'Method not allowed' });
	});

	test('returns a multi-status response for an authenticated directory request', async () => {
		const authorization = `Basic ${Buffer.from('reader:dav-password').toString('base64')}`;
		const response = await fallback(
			event(new Request('http://localhost/api/dav/library', { method: 'PROPFIND', headers: { authorization } }))
		);

		assert.equal(response.status, 207);
		assert.equal(response.headers.get('content-type'), 'application/xml; charset=utf-8');
		assert.equal(await response.text(), '<path>library</path>');
	});
});
