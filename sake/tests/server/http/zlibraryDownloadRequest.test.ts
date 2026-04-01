import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseZDownloadBookRequest } from '$lib/server/http/zlibraryDownloadRequest';

describe('parseZDownloadBookRequest', () => {
	test('normalizes multi-value identifiers to one scalar string', () => {
		const parsed = parseZDownloadBookRequest({
			bookId: '18349840',
			hash: 'bd845f',
			title: 'Harry Potter & the Deathly Hallows',
			upload: true,
			extension: 'epub',
			identifier: ['9781781100134', '1781100136'],
			downloadToDevice: false
		});

		assert.equal(parsed.identifier, '9781781100134');
		assert.equal(parsed.bookId, '18349840');
		assert.equal(parsed.hash, 'bd845f');
	});

	test('rejects invalid identifier array entries', () => {
		assert.throws(
			() =>
				parseZDownloadBookRequest({
					bookId: '18349840',
					hash: 'bd845f',
					title: 'Harry Potter & the Deathly Hallows',
					upload: true,
					extension: 'epub',
					identifier: ['9781781100134', 1781100136],
					downloadToDevice: false
				}),
			/identifier entries must be strings/
		);
	});
});
