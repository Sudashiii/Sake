import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Book } from '$lib/server/domain/entities/Book';
import { renderAcquisitionFeed, renderNavigationFeed } from '../../../../../src/routes/api/opds/feedBuilder';

const book: Book = {
	id: 7,
	zLibId: null,
	s3_storage_key: 'library/A & B.epub',
	title: 'A < Great > Book',
	author: "O'Reilly & Co",
	publisher: 'Press "One"',
	series: null,
	volume: null,
	series_index: null,
	edition: null,
	identifier: null,
	pages: null,
	description: 'A description with <unsafe> & characters',
	google_books_id: null,
	open_library_key: null,
	hardcover_id: null,
	amazon_asin: null,
	external_rating: null,
	external_rating_count: null,
	cover: 'covers/cover image.jpg?book=7&size=large',
	extension: 'epub',
	filesize: 10,
	language: 'en',
	year: 2026,
	month: 7,
	day: 10,
	progress_storage_key: null,
	progress_updated_at: null,
	progress_percent: null,
	progress_before_read: null,
	rating: null,
	read_at: null,
	archived_at: null,
	exclude_from_new_books: false,
	createdAt: '2026-07-10T00:00:00.000Z',
	deleted_at: null,
	trash_expires_at: null
};

describe('OPDS feed builder', () => {
	test('escapes acquisition metadata and encodes file and cover links', () => {
		const xml = renderAcquisitionFeed('Catalog & More', 'urn:test:<feed>', [book], '/api/opds/all');

		assert.match(xml, /<title>A &lt; Great &gt; Book<\/title>/);
		assert.match(xml, /O&apos;Reilly &amp; Co/);
		assert.match(xml, /Press &quot;One&quot;/);
		assert.match(xml, /A description with &lt;unsafe&gt; &amp; characters/);
		assert.match(xml, /download\/library%2FA%20%26%20B\.epub/);
		assert.match(xml, /covers\/cover%20image\.jpg\?book=7&amp;size=large/);
		assert.match(xml, /type="application\/epub\+zip"/);
		assert.match(xml, /image\/jpeg/);
	});

	test('renders navigation entries with escaped labels and descriptions', () => {
		const xml = renderNavigationFeed(
			'Root & Catalog',
			'urn:test:root',
			[{ title: 'A < shelf', id: 'urn:test:1', url: 'shelf/one & two', description: 'Browse & read' }],
			'/api/opds'
		);

		assert.match(xml, /<title>Root &amp; Catalog<\/title>/);
		assert.match(xml, /<title>A &lt; shelf<\/title>/);
		assert.match(xml, /href="\/api\/opds\/shelf\/one &amp; two"/);
		assert.match(xml, /<summary>Browse &amp; read<\/summary>/);
	});
});
