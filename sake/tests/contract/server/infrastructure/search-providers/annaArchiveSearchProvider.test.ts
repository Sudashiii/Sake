import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { AnnaArchiveSearchProvider } from '$lib/server/infrastructure/search-providers/AnnaArchiveSearchProvider';

interface LibgenRowFixture {
	md5: string;
	title: string;
	edition?: string;
	series?: string;
	author: string;
	year: string;
	language: string;
	size: string;
	extension: string;
	isbns?: string;
}

function buildLibgenRow(row: LibgenRowFixture): string {
	const tooltip = `Add/Edit : 2026-05-30/2026-05-30; ID: 1<br>${row.author} - ${row.title} (${row.extension})`;
	return `<tr>
		<td>${row.series ? `<b>${row.series}</b><br>` : ''}<a data-toggle="tooltip" data-html="true" title="${tooltip}" href="edition.php?id=1">${row.title} <i>${row.edition ?? ''}</i></a><br><a data-toggle="tooltip" title="${tooltip}" href="edition.php?id=1"><i><font color="green"> ${row.isbns ?? ''}</font></a></i> <nobr><span class="badge badge-secondary">f 1</span></nobr></td>
		<td>${row.author}</td>
		<td>Publisher</td>
		<td><nobr>${row.year}</nobr></td>
		<td>${row.language}</td>
		<td>0 / 300 pages</td>
		<td><nobr><a href="/file.php?id=1">${row.size}</a></nobr></td>
		<td>${row.extension}</td>
		<td><a title="libgen" href="/ads.php?md5=${row.md5}"><span class="badge badge-primary">1</span></a> <a title="anna's archive" href="https://en.annas-archive.gl/md5/${row.md5}"><span class="badge badge-primary">2</span></a></td>
	</tr>`;
}

function buildLibgenPage(rows: string[]): string {
	const table =
		rows.length > 0
			? `<table class="table  table-striped" id="tablelibgen"><thead><tr><th scope="col">Title</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
			: '';
	return `<html><head><title>Library Genesis</title></head><body>
		<ul class="nav nav-tabs"><li class="nav-item"><a class="nav-link active" href="/index.php?req=x&curtab=f">Files <span class="badge badge-primary">${rows.length}</span></a></li></ul>
		${table}
	</body></html>`;
}

function htmlResponse(html: string, status = 200): Response {
	return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function hexHash(character: string): string {
	return character.repeat(32);
}

describe('AnnaArchiveSearchProvider', () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test('searches Libgen and maps rows to normalized Anna results', async () => {
		const requestedUrls: URL[] = [];
		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));
			requestedUrls.push(requestUrl);
			return htmlResponse(
				buildLibgenPage([
					buildLibgenRow({
						md5: hexHash('a'),
						title: 'Hunters Of Dune',
						edition: '1st ed',
						series: 'Chronicles of Dune 7; Dune Universe',
						author: 'Herbert, Brian(aut); Anderson, Kevin J.(aut)',
						year: '2006;2007',
						language: 'English',
						size: '877 kB',
						extension: 'epub',
						isbns: '076535148X; 9780765351487'
					}),
					buildLibgenRow({
						md5: hexHash('a'),
						title: 'Hunters Of Dune duplicate edition',
						author: 'Herbert, Brian',
						year: '2006',
						language: 'English',
						size: '877 kB',
						extension: 'epub'
					})
				])
			);
		};

		const provider = new AnnaArchiveSearchProvider();
		const result = await provider.search({ query: '  Hunters of Dune  ' }, {});

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.equal(requestedUrls.length, 1);
		const requestUrl = requestedUrls[0];
		assert.equal(requestUrl?.origin, 'https://libgen.li');
		assert.equal(requestUrl?.pathname, '/index.php');
		assert.equal(requestUrl?.searchParams.get('req'), 'Hunters of Dune');
		assert.equal(requestUrl?.searchParams.get('res'), '25');
		assert.deepEqual(requestUrl?.searchParams.getAll('objects[]'), ['f']);
		assert.deepEqual(requestUrl?.searchParams.getAll('topics[]'), ['l', 'f']);

		assert.deepEqual(result.value, [
			{
				provider: 'anna',
				providerBookId: hexHash('a'),
				title: 'Hunters Of Dune',
				author: 'Herbert, Brian; Anderson, Kevin J.',
				language: 'English',
				year: 2006,
				extension: 'epub',
				filesize: 898048,
				cover: null,
				description: null,
				series: 'Chronicles of Dune 7',
				volume: null,
				seriesIndex: null,
				identifier: null,
				isbn: '9780765351487',
				pages: null,
				capabilities: { filesAvailable: true, metadataCompleteness: 'medium' },
				downloadRef: hexHash('a'),
				queueRef: null,
				sourceUrl: `https://annas-archive.gl/md5/${hexHash('a')}`
			}
		]);
	});

	test('filters locally and checks further pages for filtered searches', async () => {
		const requestedPages: string[] = [];
		const englishRows = Array.from({ length: 50 }, (_, index) =>
			buildLibgenRow({
				md5: index.toString(16).padStart(32, '0'),
				title: `Harry Potter and the Goblet of Fire ${index}`,
				author: 'Rowling, J. K.',
				year: '2000',
				language: 'English',
				size: '2 MB',
				extension: 'epub'
			})
		);

		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));
			const page = requestUrl.searchParams.get('page') ?? '1';
			requestedPages.push(page);
			assert.equal(requestUrl.searchParams.get('res'), '50');

			return htmlResponse(
				buildLibgenPage(
					page === '1'
						? englishRows
						: [
								buildLibgenRow({
									md5: hexHash('b'),
									title: 'Harry Potter und der Stein der Weisen',
									author: 'Rowling, Joanne K.',
									year: '1998',
									language: 'German;English',
									size: '1 MB',
									extension: 'epub'
								}),
								buildLibgenRow({
									md5: hexHash('c'),
									title: 'Harry Potter und der Stein der Weisen',
									author: 'Rowling, Joanne K.',
									year: '1998',
									language: 'German',
									size: '4 MB',
									extension: 'pdf'
								})
							]
				)
			);
		};

		const provider = new AnnaArchiveSearchProvider();
		const result = await provider.search(
			{
				query: 'Harry Potter',
				filters: { language: ['de'], extension: ['epub'], limitPerProvider: 20 }
			},
			{}
		);

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(requestedPages, ['1', '2']);
		assert.deepEqual(
			result.value.map((book) => book.providerBookId),
			[hexHash('b')]
		);
	});

	test('fails over to the next Libgen mirror and returns empty results for zero hits', async () => {
		const requestedHosts: string[] = [];
		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));
			requestedHosts.push(requestUrl.host);
			if (requestUrl.host === 'libgen.li') {
				throw new TypeError('connection refused');
			}
			if (requestUrl.host === 'libgen.gl') {
				return htmlResponse('<html><title>Maintenance</title></html>');
			}
			return htmlResponse(buildLibgenPage([]));
		};

		const provider = new AnnaArchiveSearchProvider();
		const result = await provider.search({ query: 'no such book' }, {});

		assert.deepEqual(result, { ok: true, value: [] });
		assert.deepEqual(requestedHosts, ['libgen.li', 'libgen.gl', 'libgen.bz']);
	});

	test('reports the last mirror failure when every Libgen mirror fails', async () => {
		globalThis.fetch = async (): Promise<Response> => htmlResponse('Bad gateway', 502);

		const provider = new AnnaArchiveSearchProvider();
		const result = await provider.search({ query: 'dune' }, {});

		assert.equal(result.ok, false);
		if (result.ok) {
			return;
		}

		assert.equal(result.error.status, 502);
		assert.equal(result.error.message, 'Anna search failed: libgen.la answered with status 502');
	});

	test('retries downloads on another Libgen mirror when the file CDN fails', async () => {
		const requestedUrls: string[] = [];
		const fileBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
		globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
			const requestUrl = new URL(String(input));
			requestedUrls.push(`${requestUrl.host}${requestUrl.pathname}`);

			if (requestUrl.pathname === '/ads.php') {
				return htmlResponse(
					`<a href="get.php?md5=${requestUrl.searchParams.get('md5')}&amp;key=ABC"><h2>GET</h2></a>`
				);
			}
			if (requestUrl.host === 'libgen.li') {
				return htmlResponse('Service unavailable', 503);
			}

			assert.equal(requestUrl.searchParams.get('key'), 'ABC');
			return new Response(fileBytes, {
				status: 200,
				headers: {
					'content-type': 'application/epub+zip',
					'content-disposition': 'attachment; filename="Dune.epub"'
				}
			});
		};

		const provider = new AnnaArchiveSearchProvider();
		const result = await provider.download({
			downloadRef: hexHash('d').toUpperCase(),
			title: 'Dune',
			extension: 'epub'
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(requestedUrls, [
			'libgen.li/ads.php',
			'libgen.li/get.php',
			'libgen.gl/ads.php',
			'libgen.gl/get.php'
		]);
		assert.equal(result.value.fileName, 'Dune.epub');
		assert.equal(result.value.contentType, 'application/epub+zip');
		assert.deepEqual(result.value.fileData, fileBytes);
	});

	test('returns not found without retrying when no mirror has a download link', async () => {
		let requestCount = 0;
		globalThis.fetch = async (): Promise<Response> => {
			requestCount += 1;
			return htmlResponse('<p>File not found</p>');
		};

		const provider = new AnnaArchiveSearchProvider();
		const result = await provider.download({
			downloadRef: hexHash('e'),
			title: 'Missing',
			extension: 'epub'
		});

		assert.equal(result.ok, false);
		if (result.ok) {
			return;
		}

		assert.equal(result.error.status, 404);
		assert.equal(requestCount, 4);
	});
});
