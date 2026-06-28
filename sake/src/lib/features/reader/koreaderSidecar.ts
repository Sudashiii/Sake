import {
	LuaDataDocument,
	asLuaTable,
	luaTable,
	luaTableGet,
	type LuaTable,
	type LuaValue
} from './luaData';

export const KOREADER_NORMALIZED_DOM_VERSION = 20200223;

export type ReaderAnnotationKind = 'bookmark' | 'highlight';

export interface ReaderAnnotation {
	id: string;
	kind: ReaderAnnotationKind;
	page: string;
	pos0?: string;
	pos1?: string;
	text?: string;
	note?: string;
	chapter?: string;
	drawer?: string;
	color?: string;
	datetime: string;
	datetimeUpdated?: string;
}

export interface SidecarSnapshot {
	source: string;
	percentFinished: number;
	lastXPointer: string | null;
	annotations: ReaderAnnotation[];
}

export interface SidecarChanges {
	percentFinished: number;
	lastXPointer?: string;
	upsertedAnnotations: ReaderAnnotation[];
	deletedAnnotationIds: string[];
}

function stringValue(table: LuaTable, key: string): string | undefined {
	const value = luaTableGet(table, key);
	return typeof value === 'string' ? value : undefined;
}

export function createAnnotationId(annotation: Omit<ReaderAnnotation, 'id'>): string {
	return [
		annotation.datetime,
		annotation.page,
		annotation.pos0 ?? '',
		annotation.pos1 ?? '',
		annotation.kind
	].join('\u001f');
}

function parseAnnotation(value: LuaValue): ReaderAnnotation | null {
	const table = asLuaTable(value);
	if (!table) {
		return null;
	}

	const page = stringValue(table, 'page');
	const datetime = stringValue(table, 'datetime');
	if (!page || !datetime) {
		return null;
	}

	const parsed = {
		kind: stringValue(table, 'drawer') ? ('highlight' as const) : ('bookmark' as const),
		page,
		pos0: stringValue(table, 'pos0'),
		pos1: stringValue(table, 'pos1'),
		text: stringValue(table, 'text'),
		note: stringValue(table, 'note'),
		chapter: stringValue(table, 'chapter'),
		drawer: stringValue(table, 'drawer'),
		color: stringValue(table, 'color'),
		datetime,
		datetimeUpdated: stringValue(table, 'datetime_updated')
	};
	return { ...parsed, id: createAnnotationId(parsed) };
}

function annotationToLua(annotation: ReaderAnnotation): LuaTable {
	const entries: LuaTable['entries'] = [
		{ key: 'datetime', value: annotation.datetime },
		{ key: 'datetime_updated', value: annotation.datetimeUpdated ?? null },
		{ key: 'drawer', value: annotation.kind === 'highlight' ? annotation.drawer ?? 'lighten' : null },
		{ key: 'color', value: annotation.kind === 'highlight' ? annotation.color ?? 'yellow' : null },
		{ key: 'text', value: annotation.text ?? null },
		{ key: 'note', value: annotation.note ?? null },
		{ key: 'chapter', value: annotation.chapter ?? null },
		{ key: 'page', value: annotation.page },
		{ key: 'pos0', value: annotation.pos0 ?? null },
		{ key: 'pos1', value: annotation.pos1 ?? null }
	];
	return luaTable(entries);
}

function compareModified(left: ReaderAnnotation, right: ReaderAnnotation): number {
	return (left.datetimeUpdated ?? left.datetime).localeCompare(
		right.datetimeUpdated ?? right.datetime
	);
}

export function parseKoreaderSidecar(source: string): SidecarSnapshot {
	const document = LuaDataDocument.parse(source);
	const percentValue = document.get(['percent_finished']);
	const annotationsTable = asLuaTable(document.get(['annotations']));
	const annotations =
		annotationsTable?.entries
			.filter((entry) => typeof entry.key === 'number')
			.sort((left, right) => Number(left.key) - Number(right.key))
			.map((entry) => parseAnnotation(entry.value))
			.filter((annotation): annotation is ReaderAnnotation => annotation !== null) ?? [];

	return {
		source,
		percentFinished: typeof percentValue === 'number' ? percentValue : 0,
		lastXPointer:
			typeof document.get(['last_xpointer']) === 'string'
				? (document.get(['last_xpointer']) as string)
				: null,
		annotations
	};
}

export function createMinimalKoreaderSidecar(modifiedDate: string): string {
	return LuaDataDocument.create([
		{ key: 'annotations', value: luaTable() },
		{ key: 'cre_dom_version', value: KOREADER_NORMALIZED_DOM_VERSION },
		{ key: 'percent_finished', value: 0 },
		{
			key: 'summary',
			value: luaTable([
				{ key: 'modified', value: modifiedDate },
				{ key: 'percent_finished', value: 0 },
				{ key: 'status', value: 'reading' }
			])
		}
	]).source;
}

export function mergeKoreaderSidecar(
	latestSource: string | null,
	changes: SidecarChanges,
	modifiedDate: string
): SidecarSnapshot {
	const source = latestSource ?? createMinimalKoreaderSidecar(modifiedDate);
	const latest = parseKoreaderSidecar(source);
	const deleted = new Set(changes.deletedAnnotationIds);
	const annotations = new Map(
		latest.annotations
			.filter((annotation) => !deleted.has(annotation.id))
			.map((annotation) => [annotation.id, annotation])
	);

	for (const annotation of changes.upsertedAnnotations) {
		const existing = annotations.get(annotation.id);
		if (!existing || compareModified(existing, annotation) <= 0) {
			annotations.set(annotation.id, annotation);
		}
	}

	const mergedAnnotations = [...annotations.values()].sort((left, right) => {
		const pageOrder = left.page.localeCompare(right.page);
		return pageOrder !== 0 ? pageOrder : left.datetime.localeCompare(right.datetime);
	});
	const annotationTable = luaTable(
		mergedAnnotations.map((annotation, index) => ({
			key: index + 1,
			value: annotationToLua(annotation)
		}))
	);
	const percentFinished = Math.max(0, Math.min(1, changes.percentFinished));
	const status = percentFinished >= 1 ? 'complete' : 'reading';
	const lastXPointer = changes.lastXPointer ?? latest.lastXPointer;

	let document = LuaDataDocument.parse(source);
	document = document.set(['annotations'], annotationTable);
	if (changes.lastXPointer) {
		document = document.set(['last_xpointer'], changes.lastXPointer);
	}
	document = document.set(['percent_finished'], percentFinished);
	document = document.set(['summary', 'modified'], modifiedDate);
	document = document.set(['summary', 'percent_finished'], percentFinished);
	document = document.set(['summary', 'status'], status);

	return {
		source: document.source,
		percentFinished,
		lastXPointer,
		annotations: mergedAnnotations
	};
}
