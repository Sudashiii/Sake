import type { AnnotationRepositoryPort } from '$lib/server/application/ports/AnnotationRepositoryPort';
import type { AnnotationHubItem, AnnotationQuery } from '$lib/types/Annotations/Annotation';

export type AnnotationExportFormat = 'markdown' | 'json';

function markdownText(value: string): string {
	return value.replace(/\r\n/g, '\n').split('\n').map((line) => `> ${line}`).join('\n');
}

function markdownItem(item: AnnotationHubItem): string {
	const lines = [`### ${item.chapter || (item.kind === 'bookmark' ? 'Bookmark' : 'Highlight')}`];
	lines.push(`- Type: ${item.kind}`);
	lines.push(`- Recorded: ${item.recordedAt}`);
	if (item.color) lines.push(`- Color: ${item.color}`);
	if (item.text) lines.push('', markdownText(item.text));
	if (item.note) lines.push('', item.note);
	return `${lines.join('\n')}\n\n`;
}

export class AnnotationExportService {
	constructor(private readonly repository: AnnotationRepositoryPort) {}

	async *stream(format: AnnotationExportFormat, query: AnnotationQuery): AsyncIterable<string> {
		const exportQuery = { ...query, sort: 'book' as const, cursor: null };
		if (format === 'json') {
			yield `${JSON.stringify({
				exportVersion: 1,
				exportedAt: new Date().toISOString(),
				filters: { ...exportQuery, cursor: undefined, limit: undefined }
			}).slice(0, -1)},"annotations":[`;
			let first = true;
			for await (const item of this.repository.listAllForExport(exportQuery)) {
				yield `${first ? '' : ','}${JSON.stringify(item)}`;
				first = false;
			}
			yield ']}';
			return;
		}

		yield `# Sake annotations\n\nExported ${new Date().toISOString()}\n\n`;
		let currentBookId: number | null = null;
		for await (const item of this.repository.listAllForExport(exportQuery)) {
			if (item.book.id !== currentBookId) {
				currentBookId = item.book.id;
				yield `## ${item.book.title}${item.book.author ? `, ${item.book.author}` : ''}\n\n`;
			}
			yield markdownItem(item);
		}
	}
}
