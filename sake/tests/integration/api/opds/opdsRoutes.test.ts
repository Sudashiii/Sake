import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
// @ts-expect-error Bun's test-only mock API is available at runtime but excluded from the app tsconfig.
import { mock } from 'bun:test';
import { hashPassword } from '$lib/server/application/services/LocalAuthService';

const passwordHash = await hashPassword('opds-password');

mock.module('$lib/server/application/composition', () => ({
	userRepository: {
		getByUsername: async (username: string) =>
			username === 'reader'
				? { id: 1, username, passwordHash, basicAuthPasswordHash: null, isDisabled: false }
				: undefined
	},
	getQueueStatusUseCase: { execute: async () => ({ ok: true, value: {} }) },
	queueDownloadUseCase: { execute: async () => ({ ok: true, value: {} }) },
	listDavDirectoryUseCase: {
		execute: async ({ path }: { path: string }) => ({ ok: true, value: { xml: `<path>${path}</path>` } })
	}
}));

const { GET } = await import('../../../../src/routes/api/opds/+server');

function event(request: Request) {
	return { request, url: new URL(request.url), locals: { logger: undefined } } as never;
}

describe('OPDS HTTP boundary', () => {
	test('requires Basic authentication', async () => {
		const response = await GET(event(new Request('http://localhost/api/opds')));
		assert.equal(response.status, 401);
		assert.equal(response.headers.get('www-authenticate'), 'Basic realm="OPDS Catalog"');
	});

	test('returns the authenticated navigation catalog', async () => {
		const authorization = `Basic ${Buffer.from('reader:opds-password').toString('base64')}`;
		const response = await GET(
			event(new Request('http://localhost/api/opds', { headers: { authorization } }))
		);

		assert.equal(response.status, 200);
		assert.match(await response.text(), /Sake OPDS Catalog/);
		assert.equal(response.headers.get('content-type'), 'application/atom+xml;charset=utf-8');
	});
});
