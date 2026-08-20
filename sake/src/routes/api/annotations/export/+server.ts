import type { RequestHandler } from './$types';
import { annotationExportService } from '$lib/server/application/composition';
import { errorResponse } from '$lib/server/http/api';
import { parseAnnotationQuery } from '$lib/server/http/annotationQuery';
import type { AnnotationExportFormat } from '$lib/server/application/services/AnnotationExportService';

export const GET: RequestHandler = async ({ url }) => {
	const format = url.searchParams.get('format');
	if (format !== 'markdown' && format !== 'json') {
		return errorResponse('format must be markdown or json', 400);
	}
	let query;
	try {
		query = parseAnnotationQuery(url.searchParams);
	} catch (error: unknown) {
		return errorResponse(error instanceof Error ? error.message : 'Invalid annotation query', 400);
	}
	const iterator = annotationExportService.stream(format as AnnotationExportFormat, query)[Symbol.asyncIterator]();
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const next = await iterator.next();
				if (next.done) controller.close();
				else controller.enqueue(encoder.encode(next.value));
			} catch (error: unknown) {
				controller.error(error);
			}
		},
		async cancel() {
			await iterator.return?.();
		}
	});
	const extension = format === 'markdown' ? 'md' : 'json';
	return new Response(stream, {
		headers: {
			'Content-Type': format === 'markdown' ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="sake-annotations.${extension}"`
		}
	});
};
