import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import JSZip from 'jszip';
import { EpubMetadataService } from '$lib/server/application/services/EpubMetadataService';
import { MAX_MANAGED_BOOK_COVER_BYTES } from '$lib/server/application/services/ManagedBookCoverService';

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
	<rootfiles>
		<rootfile full-path="OPS/content.opf" media-type="application/oebps-package+xml" />
	</rootfiles>
</container>`;

async function buildEpub(
	opfXml: string,
	files: Record<string, string | Buffer> = {}
): Promise<Buffer> {
	const zip = new JSZip();
	zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
	zip.file('META-INF/container.xml', CONTAINER_XML);
	zip.file('OPS/content.opf', opfXml);
	for (const [filePath, value] of Object.entries(files)) {
		zip.file(filePath, value);
	}
	return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

describe('EpubMetadataService.extractMetadata', () => {
	test('extracts common upload metadata from OPF content', async () => {
		const service = new EpubMetadataService();
		const epub = await buildEpub(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<metadata>
		<dc:title>Example &amp; Test</dc:title>
		<dc:creator>Jane Doe</dc:creator>
		<dc:creator>John Roe</dc:creator>
		<dc:identifier>urn:isbn:9781234567897</dc:identifier>
		<dc:publisher>Acme Press</dc:publisher>
		<dc:description><![CDATA[<p>Hello</p> world]]></dc:description>
		<dc:language>EN-US</dc:language>
		<dc:date>2022-05-01</dc:date>
	</metadata>
</package>`);

		const metadata = await service.extractMetadata(epub);

		assert.deepEqual(metadata, {
			title: 'Example & Test',
			author: 'Jane Doe, John Roe',
			publisher: 'Acme Press',
			identifier: '9781234567897',
			description: 'Hello world',
			language: 'en-us',
			year: 2022,
			month: 5,
			day: 1
		});
	});

	test('returns partial metadata when only some fields exist', async () => {
		const service = new EpubMetadataService();
		const epub = await buildEpub(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<metadata>
		<dc:title>Only Title</dc:title>
		<dc:language>de</dc:language>
	</metadata>
</package>`);

		const metadata = await service.extractMetadata(epub);

		assert.deepEqual(metadata, {
			title: 'Only Title',
			author: null,
			publisher: null,
			identifier: null,
			description: null,
			language: 'de',
			year: null,
			month: null,
			day: null
		});
	});

	test('extracts partial publication dates when only year and month are present', async () => {
		const service = new EpubMetadataService();
		const epub = await buildEpub(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<metadata>
		<dc:title>Month Precision</dc:title>
		<dc:date>2022-05</dc:date>
	</metadata>
</package>`);

		const metadata = await service.extractMetadata(epub);

		assert.deepEqual(metadata, {
			title: 'Month Precision',
			author: null,
			publisher: null,
			identifier: null,
			description: null,
			language: null,
			year: 2022,
			month: 5,
			day: null
		});
	});

	test('accepts non-zero-padded year-month publication dates from EPUB metadata', async () => {
		const service = new EpubMetadataService();
		const epub = await buildEpub(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<metadata>
		<dc:title>Loose Month Padding</dc:title>
		<dc:date>2022-5</dc:date>
	</metadata>
</package>`);

		const metadata = await service.extractMetadata(epub);

		assert.deepEqual(metadata, {
			title: 'Loose Month Padding',
			author: null,
			publisher: null,
			identifier: null,
			description: null,
			language: null,
			year: 2022,
			month: 5,
			day: null
		});
	});

	test('accepts non-zero-padded publication dates from EPUB metadata', async () => {
		const service = new EpubMetadataService();
		const epub = await buildEpub(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<metadata>
		<dc:title>Loose Date Padding</dc:title>
		<dc:date>2022-5-1</dc:date>
	</metadata>
</package>`);

		const metadata = await service.extractMetadata(epub);

		assert.deepEqual(metadata, {
			title: 'Loose Date Padding',
			author: null,
			publisher: null,
			identifier: null,
			description: null,
			language: null,
			year: 2022,
			month: 5,
			day: 1
		});
	});

	test('extracts full publication dates from timestamp values', async () => {
		const service = new EpubMetadataService();
		const epub = await buildEpub(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<metadata>
		<dc:title>Timestamp Date</dc:title>
		<dc:date>2021-09-14T08:30:00Z</dc:date>
	</metadata>
</package>`);

		const metadata = await service.extractMetadata(epub);

		assert.deepEqual(metadata, {
			title: 'Timestamp Date',
			author: null,
			publisher: null,
			identifier: null,
			description: null,
			language: null,
			year: 2021,
			month: 9,
			day: 14
		});
	});

	test('falls back safely when EPUB dates are malformed', async () => {
		const service = new EpubMetadataService();
		const epub = await buildEpub(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<metadata>
		<dc:title>Malformed Date</dc:title>
		<dc:date>2022-13-40</dc:date>
	</metadata>
</package>`);

		const metadata = await service.extractMetadata(epub);

		assert.deepEqual(metadata, {
			title: 'Malformed Date',
			author: null,
			publisher: null,
			identifier: null,
			description: null,
			language: null,
			year: 2022,
			month: null,
			day: null
		});
	});

	test('extracts an embedded cover image from common EPUB manifest metadata', async () => {
		const service = new EpubMetadataService();
		const coverBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
		const epub = await buildEpub(
			`<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<metadata>
		<dc:title>Cover Book</dc:title>
		<meta name="cover" content="cover-image" />
	</metadata>
	<manifest>
		<item id="cover-image" href="images/cover.png" media-type="image/png" />
	</manifest>
</package>`,
			{
				'OPS/images/cover.png': coverBytes
			}
		);

		const uploadData = await service.extractUploadData(epub);

		assert.deepEqual(uploadData.metadata, {
			title: 'Cover Book',
			author: null,
			publisher: null,
			identifier: null,
			description: null,
			language: null,
			year: null,
			month: null,
			day: null
		});
		assert.deepEqual(uploadData.cover, {
			data: coverBytes,
			contentType: 'image/png'
		});
	});

	test('skips oversized embedded cover images', async () => {
		const service = new EpubMetadataService();
		const epub = await buildEpub(
			`<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<metadata>
		<dc:title>Large Cover Book</dc:title>
		<meta name="cover" content="cover-image" />
	</metadata>
	<manifest>
		<item id="cover-image" href="images/cover.png" media-type="image/png" />
	</manifest>
</package>`,
			{
				'OPS/images/cover.png': Buffer.alloc(MAX_MANAGED_BOOK_COVER_BYTES + 1, 1)
			}
		);

		const uploadData = await service.extractUploadData(epub);

		assert.equal(uploadData.metadata?.title, 'Large Cover Book');
		assert.equal(uploadData.cover, null);
	});

	test('returns null for malformed or non-compliant EPUB data', async () => {
		const service = new EpubMetadataService();

		const metadata = await service.extractMetadata(Buffer.from('not-a-valid-epub'));

		assert.equal(metadata, null);
	});
});
