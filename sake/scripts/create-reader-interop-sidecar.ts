import { mergeKoreaderSidecar, createAnnotationId } from '$lib/koreader/koreaderSidecar';
import { toKoreaderXPointer, type DomNodeLike } from '$lib/features/reader/koreaderXPointer';

class FixtureNode implements DomNodeLike {
	readonly childNodes: FixtureNode[] = [];
	parentNode: FixtureNode | null = null;

	constructor(
		readonly nodeType: number,
		readonly nodeName: string,
		readonly nodeValue: string | null = null
	) {}

	append(...children: FixtureNode[]): this {
		for (const child of children) {
			child.parentNode = this;
			this.childNodes.push(child);
		}
		return this;
	}
}

function element(name: string, ...children: FixtureNode[]): FixtureNode {
	return new FixtureNode(1, name).append(...children);
}

function text(value: string): FixtureNode {
	return new FixtureNode(3, '#text', value);
}

function fixturePointers(): { start: string; end: string; last: string } {
	const nestedPrefix = text('Start nested ');
	const nestedWord = text('markup');
	element(
		'body',
		element(
			'section',
			element('p', text('First paragraph.')),
			element('p', nestedPrefix, element('em', nestedWord), text(' end.'))
		)
	);
	const secondChapterText = text('A😀BC second chapter.');
	element('body', element('section', element('p', secondChapterText)));

	return {
		start: toKoreaderXPointer(
			{ node: nestedPrefix, offset: 6 },
			{ spineIndex: 0, spineCount: 2 },
			'forward'
		),
		end: toKoreaderXPointer(
			{ node: nestedWord, offset: nestedWord.nodeValue?.length ?? 0 },
			{ spineIndex: 0, spineCount: 2 },
			'backward'
		),
		last: toKoreaderXPointer(
			{ node: secondChapterText, offset: 3 },
			{ spineIndex: 1, spineCount: 2 },
			'forward'
		)
	};
}

const outputPath = process.argv[2];
if (!outputPath) {
	throw new Error('Usage: bun scripts/create-reader-interop-sidecar.ts <metadata.epub.lua>');
}

const datetime = '2026-06-06 10:00:00';
const pointers = fixturePointers();
const highlightBase = {
	kind: 'highlight' as const,
	page: pointers.start,
	pos0: pointers.start,
	pos1: pointers.end,
	text: 'nested markup',
	note: 'Interop note',
	chapter: 'One',
	drawer: 'lighten',
	color: 'yellow',
	datetime,
	datetimeUpdated: datetime
};
const source = `return {
    ["annotations"] = {},
    ["cre_dom_version"] = 20240114,
    ["unknown_fixture_setting"] = "preserved",
}
`;
const merged = mergeKoreaderSidecar(
	source,
	{
		percentFinished: 0.5,
		lastXPointer: pointers.last,
		upsertedAnnotations: [
			{ ...highlightBase, id: createAnnotationId(highlightBase) }
		],
		deletedAnnotationIds: []
	},
	'2026-06-06'
);

await Bun.write(outputPath, merged.source);
