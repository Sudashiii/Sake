import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AnnotationExportService } from '$lib/server/application/services/AnnotationExportService';
import type { AnnotationRepositoryPort } from '$lib/server/application/ports/AnnotationRepositoryPort';
import { EMPTY_ANNOTATION_QUERY, type AnnotationHubItem } from '$lib/types/Annotations/Annotation';

const item: AnnotationHubItem = {
	id: 1, version: 'v1-test', kind: 'highlight', page: '/body/p', pos0: '/body/p', pos1: '/body/p.4',
	text: 'A remembered passage', note: 'Keep this', chapter: 'One', drawer: 'lighten', color: 'yellow',
	recordedAt: '2026-08-16 10:00:00', updatedAt: null,
	book: { id: 2, title: 'Memory Book', author: 'Reader', cover: null, extension: 'epub', isArchived: false }
};

async function collect(stream: AsyncIterable<string>): Promise<string> {
	let result = '';
	for await (const chunk of stream) result += chunk;
	return result;
}

describe('AnnotationExportService', () => {
	const repository = {
		async *listAllForExport() { yield item; }
	} as unknown as AnnotationRepositoryPort;
	const service = new AnnotationExportService(repository);

	test('writes readable Markdown grouped by book', async () => {
		const output = await collect(service.stream('markdown', EMPTY_ANNOTATION_QUERY));
		assert.match(output, /## Memory Book, Reader/);
		assert.match(output, /> A remembered passage/);
		assert.match(output, /Keep this/);
	});

	test('writes versioned JSON preserving book context and positions', async () => {
		const output = JSON.parse(await collect(service.stream('json', EMPTY_ANNOTATION_QUERY)));
		assert.equal(output.exportVersion, 1);
		assert.equal(output.annotations[0].pos0, '/body/p');
		assert.equal(output.annotations[0].book.title, 'Memory Book');
	});
});
