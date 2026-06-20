import { mergeKoreaderSidecar, createAnnotationId } from '$lib/features/reader/koreaderSidecar';

const outputPath = process.argv[2];
if (!outputPath) {
	throw new Error('Usage: bun scripts/create-reader-interop-sidecar.ts <metadata.epub.lua>');
}

const datetime = '2026-06-06 10:00:00';
const highlightBase = {
	kind: 'highlight' as const,
	page: '/body/DocFragment[1]/body/section/p[2]/text()[1].6',
	pos0: '/body/DocFragment[1]/body/section/p[2]/text()[1].6',
	pos1: '/body/DocFragment[1]/body/section/p[2]/em/text().6',
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
		lastXPointer: '/body/DocFragment[2]/body/section/p/text().2',
		upsertedAnnotations: [
			{ ...highlightBase, id: createAnnotationId(highlightBase) }
		],
		deletedAnnotationIds: []
	},
	'2026-06-06'
);

await Bun.write(outputPath, merged.source);
