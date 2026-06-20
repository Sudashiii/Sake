import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	fromKoreaderXPointer,
	toKoreaderXPointer,
	type DomNodeLike
} from '$lib/features/reader/koreaderXPointer';
import { cfiToKoreaderXPointer } from '$lib/features/reader/readerRuntime';

class TestNode implements DomNodeLike {
	readonly childNodes: TestNode[] = [];
	parentNode: TestNode | null = null;

	constructor(
		readonly nodeType: number,
		readonly nodeName: string,
		readonly nodeValue: string | null = null
	) {}

	append(...children: TestNode[]): this {
		for (const child of children) {
			child.parentNode = this;
			this.childNodes.push(child);
		}
		return this;
	}
}

function element(name: string, ...children: TestNode[]): TestNode {
	return new TestNode(1, name).append(...children);
}

function text(value: string): TestNode {
	return new TestNode(3, '#text', value);
}

describe('KOReader normalized EPUB XPointers', () => {
	test('converts nested repeated elements and text nodes in a multi-item spine', () => {
		const first = text('First');
		const second = text('Nested ');
		const emphasized = text('selection');
		const body = element(
			'BODY',
			element('section', element('p', first), element('p', second, element('em', emphasized)))
		);

		const xpointer = toKoreaderXPointer(
			{ node: emphasized, offset: 4 },
			{ spineIndex: 1, spineCount: 2 },
			'forward'
		);

		assert.equal(
			xpointer,
			'/body/DocFragment[2]/body/section/p[2]/em/text().4'
		);
		assert.deepEqual(
			fromKoreaderXPointer(xpointer, body, { spineIndex: 1, spineCount: 2 }),
			{ node: emphasized, offset: 4 }
		);
	});

	test('translates browser UTF-16 offsets to CREngine Unicode code-point offsets', () => {
		const content = text('A😀BC');
		const body = element('body', element('p', content));
		const xpointer = toKoreaderXPointer(
			{ node: content, offset: 3 },
			{ spineIndex: 0, spineCount: 1 },
			'forward'
		);

		assert.equal(xpointer, '/body/DocFragment/body/p/text().2');
		assert.deepEqual(
			fromKoreaderXPointer(xpointer, body, { spineIndex: 0, spineCount: 1 }),
			{ node: content, offset: 3 }
		);
	});

	test('normalizes element boundaries to adjacent text boundaries', () => {
		const first = text('one');
		const second = text('two');
		const paragraph = element('p', element('span', first), element('span', second));
		element('body', paragraph);

		assert.equal(
			toKoreaderXPointer(
				{ node: paragraph, offset: 1 },
				{ spineIndex: 0, spineCount: 1 },
				'forward'
			),
			'/body/DocFragment/body/p/span[2]/text().0'
		);
		assert.equal(
			toKoreaderXPointer(
				{ node: paragraph, offset: 1 },
				{ spineIndex: 0, spineCount: 1 },
				'backward'
			),
			'/body/DocFragment/body/p/span[1]/text().3'
		);
	});

	test('rejects an XPointer for a different spine item', () => {
		const content = text('chapter');
		const body = element('body', element('p', content));

		assert.equal(
			fromKoreaderXPointer(
				'/body/DocFragment[2]/body/p/text().0',
				body,
				{ spineIndex: 0, spineCount: 2 }
			),
			null
		);
	});

	test('returns null instead of throwing for an image-only rendition location', () => {
		const body = element('body', element('img'));
		const document = {};
		const startContainer = Object.assign(body, { ownerDocument: document });
		const rendition = {
			getRange: () => ({
				startContainer,
				startOffset: 0
			}),
			getContents: () => [{ document, sectionIndex: 0 }]
		};

		assert.equal(cfiToKoreaderXPointer(rendition as never, 'epubcfi(/6/2)', 1), null);
	});
});
