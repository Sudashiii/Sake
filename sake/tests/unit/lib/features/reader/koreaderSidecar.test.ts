import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LuaDataDocument } from '$lib/koreader/luaData';
import {
	createMinimalKoreaderSidecar,
	createAnnotationVersion,
	mergeKoreaderSidecar,
	parseKoreaderSidecar,
	type ReaderAnnotation
} from '$lib/koreader/koreaderSidecar';

const EXISTING_SIDECAR = `return {
    ["annotations"] = {
        [1] = {
            ["chapter"] = "Chapter One",
            ["color"] = "yellow",
            ["datetime"] = "2026-06-01 09:00:00",
            ["drawer"] = "lighten",
            ["page"] = "/body/DocFragment[1]/body/p/text().0",
            ["pos0"] = "/body/DocFragment[1]/body/p/text().0",
            ["pos1"] = "/body/DocFragment[1]/body/p/text().4",
			["text"] = "Test",
			["plugin_payload"] = {
				["score"] = 7,
			},
        },
    },
    ["cre_dom_version"] = 20240114,
    ["last_xpointer"] = "/body/DocFragment[1]/body/p/text().0",
    ["percent_finished"] = 0.25,
    ["summary"] = {
        ["modified"] = "2026-06-01",
        ["status"] = "reading",
        ["unknown_summary_value"] = "keep me",
    },
    ["unknown_plugin_setting"] = {
        ["enabled"] = true,
        ["value"] = "preserve this exact block",
    },
}
`;

function annotation(overrides: Partial<ReaderAnnotation> = {}): ReaderAnnotation {
	const base: ReaderAnnotation = {
		id: 'web-note',
		kind: 'highlight',
		page: '/body/DocFragment[2]/body/p/text().0',
		pos0: '/body/DocFragment[2]/body/p/text().0',
		pos1: '/body/DocFragment[2]/body/p/text().5',
		text: 'Hello',
		note: 'A note',
		chapter: 'Chapter Two',
		drawer: 'lighten',
		color: 'yellow',
		datetime: '2026-06-06 10:00:00',
		datetimeUpdated: '2026-06-06 10:01:00'
	};
	return { ...base, ...overrides };
}

describe('KOReader sidecar data handling', () => {
	test('rejects executable Lua instead of evaluating it', () => {
		assert.throws(
			() => LuaDataDocument.parse('return { ["value"] = os.execute("echo nope") }'),
			/Unsupported executable Lua expression/
		);
		assert.throws(
			() => LuaDataDocument.parse('local value = 1; return { ["value"] = value }'),
			/one return statement/
		);
	});

	test('creates a minimal sidecar KOReader can extend', () => {
		const source = createMinimalKoreaderSidecar('2026-06-06');
		const parsed = parseKoreaderSidecar(source);

		assert.equal(parsed.percentFinished, 0);
		assert.equal(parsed.lastXPointer, null);
		assert.deepEqual(parsed.annotations, []);
		assert.match(source, /\["cre_dom_version"\] = 20200223/);
	});

	test('patches known values while preserving unrelated source text', () => {
		const unknownBlock = `    ["unknown_plugin_setting"] = {
        ["enabled"] = true,
        ["value"] = "preserve this exact block",
    },`;
		const merged = mergeKoreaderSidecar(
			EXISTING_SIDECAR,
			{
				percentFinished: 0.5,
				lastXPointer: '/body/DocFragment[2]/body/p/text().0',
				upsertedAnnotations: [annotation()],
				deletedAnnotationIds: []
			},
			'2026-06-06'
		);

		assert.match(merged.source, /\["percent_finished"\] = 0\.5/);
		assert.match(merged.source, /\["cre_dom_version"\] = 20240114/);
		assert.match(merged.source, /\["unknown_summary_value"\] = "keep me"/);
		assert.match(merged.source, /\["plugin_payload"\][\s\S]*\["score"\] = 7/);
		assert.ok(merged.source.includes(unknownBlock));
		assert.equal(merged.annotations.length, 2);
	});

	test('merges newer annotation updates and applies deletions by identity', () => {
		const existing = parseKoreaderSidecar(EXISTING_SIDECAR).annotations[0];
		const newAnnotation = annotation();
		const merged = mergeKoreaderSidecar(
			EXISTING_SIDECAR,
			{
				percentFinished: 0.6,
				lastXPointer: newAnnotation.page,
				upsertedAnnotations: [
					annotation({ note: 'Newest note', datetimeUpdated: '2026-06-06 10:02:00' })
				],
				deletedAnnotationIds: [existing.id]
			},
			'2026-06-06'
		);

		assert.equal(merged.annotations.length, 1);
		assert.equal(merged.annotations[0].note, 'Newest note');
		assert.equal(parseKoreaderSidecar(merged.source).annotations[0].note, 'Newest note');
	});

	test('preserves unknown annotation fields while editing known fields', () => {
		const existing = parseKoreaderSidecar(EXISTING_SIDECAR).annotations[0];
		const merged = mergeKoreaderSidecar(
			EXISTING_SIDECAR,
			{
				percentFinished: 0.25,
				upsertedAnnotations: [
					{ ...existing, note: 'Edited note', datetimeUpdated: '2026-06-06 11:00:00' }
				],
				deletedAnnotationIds: []
			},
			'2026-06-06'
		);

		assert.match(merged.source, /\["plugin_payload"\][\s\S]*\["score"\] = 7/);
		assert.equal(parseKoreaderSidecar(merged.source).annotations[0].note, 'Edited note');
	});

	test('adds a missing summary table without disturbing other fields', () => {
		const merged = mergeKoreaderSidecar(
			'return {\n    ["custom"] = 42,\n}\n',
			{
				percentFinished: 1,
				lastXPointer: '/body/DocFragment/body/p/text().0',
				upsertedAnnotations: [],
				deletedAnnotationIds: []
			},
			'2026-06-06'
		);

		const document = LuaDataDocument.parse(merged.source);
		assert.equal(document.get(['custom']), 42);
		assert.equal(document.get(['summary', 'status']), 'complete');
		assert.equal(document.get(['summary', 'percent_finished']), 1);
	});

	test('preserves the existing location when a relocation has no text XPointer', () => {
		const merged = mergeKoreaderSidecar(
			EXISTING_SIDECAR,
			{
				percentFinished: 0.5,
				upsertedAnnotations: [],
				deletedAnnotationIds: []
			},
			'2026-06-06'
		);

		assert.equal(merged.lastXPointer, '/body/DocFragment[1]/body/p/text().0');
		assert.equal(
			LuaDataDocument.parse(merged.source).get(['last_xpointer']),
			'/body/DocFragment[1]/body/p/text().0'
		);
	});

	test('creates stable versions that change with editable annotation content', () => {
		const original = annotation();
		assert.equal(createAnnotationVersion(original), createAnnotationVersion({ ...original }));
		assert.notEqual(createAnnotationVersion(original), createAnnotationVersion({ ...original, note: 'Changed' }));
		assert.notEqual(createAnnotationVersion(original), createAnnotationVersion({ ...original, color: 'blue' }));
	});
});
