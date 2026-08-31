import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { saveKoreaderSidecar } from '$lib/features/reader/koreaderSidecarClient';

const RESPONSE_SOURCE = `return {
    ["annotations"] = {},
    ["last_xpointer"] = "/body/DocFragment/body/p/text().7",
    ["percent_finished"] = 0.7,
}
`;

describe('KOReader sidecar client', () => {
	test('sends web-sidecar changes to the server merge endpoint', async () => {
		const originalFetch = globalThis.fetch;
		let requestUrl = '';
		let requestInit: RequestInit | undefined;
		globalThis.fetch = async (input, init) => {
			requestUrl = String(input);
			requestInit = init;
			return new Response(
				JSON.stringify({
					success: true,
					progressKey: 'Example.sdr/metadata.epub.lua',
					sidecar: { source: RESPONSE_SOURCE }
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		};

		try {
			const snapshot = await saveKoreaderSidecar(
				'Example.epub',
				{
					percentFinished: 0.6,
					lastXPointer: '/body/DocFragment/body/p/text().6',
					upsertedAnnotations: [],
					deletedAnnotationIds: []
				},
				'48d2f83f-7568-4f58-8c48-1e773c0d7b58'
			);

			assert.equal(requestUrl, '/api/library/progress/web');
			assert.equal(requestInit?.method, 'PUT');
			assert.equal(requestInit?.headers && new Headers(requestInit.headers).get('Content-Type'), 'application/json');
			assert.deepEqual(JSON.parse(String(requestInit?.body)), {
				fileName: 'Example.epub',
				readerSessionId: '48d2f83f-7568-4f58-8c48-1e773c0d7b58',
				percentFinished: 0.6,
				lastXPointer: '/body/DocFragment/body/p/text().6',
				upsertedAnnotations: [],
				deletedAnnotationIds: []
			});
			assert.equal(snapshot.percentFinished, 0.7);
			assert.equal(snapshot.lastXPointer, '/body/DocFragment/body/p/text().7');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
