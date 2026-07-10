import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { HardcoverMetadataProvider } from '$lib/server/infrastructure/metadata-providers/hardcoverMetadataProvider';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('HardcoverMetadataProvider', () => {
	const originalFetch = globalThis.fetch;
	const originalApiToken = process.env.HARDCOVER_API_TOKEN;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalApiToken === undefined) {
			delete process.env.HARDCOVER_API_TOKEN;
		} else {
			process.env.HARDCOVER_API_TOKEN = originalApiToken;
		}
	});

	test('maps Hardcover search result documents to metadata candidates', async () => {
		globalThis.fetch = async (
			input: RequestInfo | URL,
			init?: RequestInit
		): Promise<Response> => {
			assert.equal(String(input), 'https://api.hardcover.app/v1/graphql');
			const headers = init?.headers as Record<string, string>;
			assert.equal(headers.Authorization, 'Bearer test-token');
			const body = JSON.parse(String(init?.body)) as {
				query: string;
				variables: { query: string; limit: number };
			};
			assert.match(body.query, /search\(query: \$query, query_type: "Book"/);
			assert.equal(body.variables.query, 'Project Hail Mary');
			assert.equal(body.variables.limit, 5);

			return jsonResponse({
				data: {
					search: {
						ids: [427578],
						results: {
							hits: [
								{
									document: {
										id: '427578',
										title: 'Project Hail Mary',
										subtitle: 'A Novel',
										author_names: ['Andy Weir'],
										description: 'A rescue mission in deep space.',
										genres: ['Science Fiction', 'Fiction'],
										tags: ['Space'],
										image: {
											url: 'https://assets.hardcover.app/editions/3274049/project.jpg',
											width: 994,
											height: 1500
										},
										isbns: ['0593135210', '9780593135211'],
										pages: 496,
										rating: 4.496923319659198,
										ratings_count: 6338,
										release_date: '2021-01-01',
										series_names: [],
										slug: 'project-hail-mary'
									}
								}
							]
						}
					}
				}
			});
		};

		const provider = new HardcoverMetadataProvider('test-token');
		const result = await provider.lookup({
			title: 'Project Hail Mary',
			author: 'Andy Weir',
			isbn: '9780593135211',
			language: 'en'
		});

		assert.equal(result.ok, true);
		if (!result.ok) return;

		const candidate = result.value[0];
		assert.equal(candidate?.providerId, 'hardcover');
		assert.equal(candidate?.identifiers.hardcoverId, '427578');
		assert.equal(candidate?.identifiers.isbn13, '9780593135211');
		assert.equal(candidate?.identifiers.isbn10, '0593135210');
		assert.equal(candidate?.title, 'Project Hail Mary');
		assert.equal(candidate?.subtitle, 'A Novel');
		assert.deepEqual(candidate?.authors, ['Andy Weir']);
		assert.equal(candidate?.description, 'A rescue mission in deep space.');
		assert.equal(candidate?.pageCount, 496);
		assert.equal(candidate?.publishedDate.year, 2021);
		assert.deepEqual(candidate?.covers, [
			{
				url: 'https://assets.hardcover.app/editions/3274049/project.jpg',
				source: 'hardcover',
				width: 994,
				height: 1500
			}
		]);
		assert.equal(candidate?.rating.average, 4.496923319659198);
		assert.equal(candidate?.rating.count, 6338);
		assert.equal(candidate?.sourceUrl, 'https://hardcover.app/books/project-hail-mary');
		assert.ok((candidate?.providerScore ?? 0) >= 10);
	});
});
