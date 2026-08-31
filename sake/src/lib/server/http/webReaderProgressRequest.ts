import type { ReaderAnnotation, SidecarChanges } from '$lib/koreader/koreaderSidecar';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTIONAL_ANNOTATION_STRING_FIELDS = [
	'pos0',
	'pos1',
	'text',
	'note',
	'chapter',
	'drawer',
	'color',
	'datetimeUpdated'
] as const;

type JsonObject = Record<string, unknown>;

export interface ParsedWebProgressRequest {
	fileName: string;
	readerSessionId: string;
	changes: SidecarChanges;
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAnnotation(value: unknown): ReaderAnnotation | null {
	if (!isJsonObject(value)) return null;
	if (
		typeof value.id !== 'string' ||
		value.id.length === 0 ||
		(value.kind !== 'bookmark' && value.kind !== 'highlight') ||
		typeof value.page !== 'string' ||
		value.page.length === 0 ||
		typeof value.datetime !== 'string' ||
		value.datetime.length === 0
	) {
		return null;
	}

	for (const field of OPTIONAL_ANNOTATION_STRING_FIELDS) {
		if (value[field] !== undefined && typeof value[field] !== 'string') return null;
	}

	return {
		id: value.id,
		kind: value.kind,
		page: value.page,
		pos0: value.pos0 as string | undefined,
		pos1: value.pos1 as string | undefined,
		text: value.text as string | undefined,
		note: value.note as string | undefined,
		chapter: value.chapter as string | undefined,
		drawer: value.drawer as string | undefined,
		color: value.color as string | undefined,
		datetime: value.datetime,
		datetimeUpdated: value.datetimeUpdated as string | undefined
	};
}

export function parseWebProgressRequest(value: unknown):
	| { ok: true; value: ParsedWebProgressRequest }
	| { ok: false; message: string } {
	if (!isJsonObject(value)) return { ok: false, message: 'Request body must be a JSON object' };

	const fileName = value.fileName;
	const readerSessionId = value.readerSessionId;
	if (typeof fileName !== 'string' || fileName.length === 0) {
		return { ok: false, message: 'fileName is required' };
	}
	if (typeof readerSessionId !== 'string' || !UUID_PATTERN.test(readerSessionId)) {
		return { ok: false, message: 'readerSessionId must be a UUID' };
	}

	const percentFinished = value.percentFinished;
	if (
		percentFinished !== undefined &&
		(typeof percentFinished !== 'number' ||
			!Number.isFinite(percentFinished) ||
			percentFinished < 0 ||
			percentFinished > 1)
	) {
		return { ok: false, message: 'percentFinished must be a number between 0 and 1' };
	}

	const lastXPointer = value.lastXPointer;
	if (
		lastXPointer !== undefined &&
		(typeof lastXPointer !== 'string' || lastXPointer.length === 0)
	) {
		return { ok: false, message: 'lastXPointer must be a non-empty string' };
	}
	if ((percentFinished === undefined) !== (lastXPointer === undefined)) {
		return { ok: false, message: 'percentFinished and lastXPointer must be provided together' };
	}

	if (!Array.isArray(value.upsertedAnnotations)) {
		return { ok: false, message: 'upsertedAnnotations must be an array' };
	}
	const upsertedAnnotations: ReaderAnnotation[] = [];
	for (const annotationValue of value.upsertedAnnotations) {
		const annotation = parseAnnotation(annotationValue);
		if (!annotation) {
			return { ok: false, message: 'upsertedAnnotations contains an invalid annotation' };
		}
		upsertedAnnotations.push(annotation);
	}

	const deletedAnnotationIds = value.deletedAnnotationIds;
	if (
		!Array.isArray(deletedAnnotationIds) ||
		!deletedAnnotationIds.every((id) => typeof id === 'string' && id.length > 0)
	) {
		return { ok: false, message: 'deletedAnnotationIds must be an array of non-empty strings' };
	}

	return {
		ok: true,
		value: {
			fileName,
			readerSessionId,
			changes: {
				percentFinished,
				lastXPointer,
				upsertedAnnotations,
				deletedAnnotationIds
			}
		}
	};
}
