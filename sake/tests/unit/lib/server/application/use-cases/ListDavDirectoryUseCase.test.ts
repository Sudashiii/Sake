import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { ListDavDirectoryUseCase } from '$lib/server/application/use-cases/ListDavDirectoryUseCase';

describe('ListDavDirectoryUseCase', () => {
	test('normalizes paths and renders directory objects as WebDAV XML', async () => {
		let requestedPrefix = '';
		const storage: StoragePort = {
			async put() {},
			async get() {
				return Buffer.from('');
			},
			async delete() {},
			async list(prefix) {
				requestedPrefix = prefix;
				return [{ key: 'library/A & B.epub', size: 42, lastModified: new Date('2026-07-10T00:00:00.000Z') }];
			}
		};

		const result = await new ListDavDirectoryUseCase(storage).execute({ path: '//library//' });

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(requestedPrefix, 'library');
		assert.match(result.value.xml, /<D:href>\/library<\/D:href>/);
		assert.match(result.value.xml, /library%2FA%20%26%20B\.epub/);
		assert.match(result.value.xml, /<D:getcontentlength>42<\/D:getcontentlength>/);
	});
});
