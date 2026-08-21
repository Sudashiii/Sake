import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ZLibraryPort } from '$lib/server/application/ports/ZLibraryPort';
import { apiError, apiOk } from '$lib/server/http/api';
import { ZLibrarySearchProvider } from '$lib/server/infrastructure/search-providers/ZLibrarySearchProvider';

describe('ZLibrarySearchProvider', () => {
	test('resolves relative source and cover URLs against the successful mirror', async () => {
		const zlibrary: ZLibraryPort = {
			signup: async () => apiError('unused', 501),
			passwordLogin: async () => apiError('unused', 501),
			tokenLogin: async () => apiOk(undefined),
			search: async () =>
				apiOk({
					mirrorUrl: 'https://second.example/zlib',
					response: {
						success: 1,
						books: [
							{
								_isUserSavedBook: false,
								active: 1,
								author: 'Author',
								content_type: 'book',
								cover: '/covers/book.jpg',
								deleted: 0,
								description: 'Description',
								dl: '',
								edition: null,
								extension: 'epub',
								filesize: 100,
								filesizeString: '100 B',
								hash: 'hash',
								href: '/book/1',
								id: 1,
								identifier: '9780000000000',
								interestScore: '1',
								kindleAvailable: false,
								language: 'English',
								md5: 'md5',
								pages: 10,
								publisher: 'Publisher',
								qualityScore: '1',
								readOnlineAvailable: false,
								readOnlineUrl: '',
								sendToEmailAvailable: false,
								series: '',
								sha256: 'sha256',
								terms_hash: '',
								title: 'Title',
								volume: '',
								year: 2024
							}
						]
					}
				}),
			download: async () => apiError('unused', 501)
		};

		const result = await new ZLibrarySearchProvider(zlibrary).search(
			{ query: 'book' },
			{ zlibraryCredentials: { userId: 'user-1', userKey: 'key-1' } }
		);

		assert.equal(result.ok, true);
		if (!result.ok) return;
		assert.equal(result.value[0]?.sourceUrl, 'https://second.example/zlib/book/1');
		assert.equal(result.value[0]?.cover, 'https://second.example/zlib/covers/book.jpg');
	});
});
