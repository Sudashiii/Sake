import type Book from 'epubjs/types/book';
import type Contents from 'epubjs/types/contents';
import type { NavItem } from 'epubjs/types/navigation';
import type Rendition from 'epubjs/types/rendition';
import {
	fromKoreaderXPointer,
	toKoreaderXPointer,
	type SpineLocation
} from './koreaderXPointer';
import type { ReaderAnnotation } from '$lib/koreader/koreaderSidecar';
import { recoverUniqueTextRange } from './quoteRecovery';

export interface SelectionDraft {
	page: string;
	pos0: string;
	pos1: string;
	text: string;
	chapter?: string;
}

export function renditionContents(rendition: Rendition | null): Contents[] {
	if (!rendition) return [];
	const value: unknown = rendition.getContents();
	return Array.isArray(value) ? (value as Contents[]) : value ? [value as Contents] : [];
}

export function xpointerSpineIndex(xpointer: string): number {
	const match = xpointer.match(/^\/body\/DocFragment(?:\[(\d+)])?\//);
	return match ? Number.parseInt(match[1] ?? '1', 10) - 1 : 0;
}

export function chapterFor(book: Book, toc: NavItem[], index: number): string | undefined {
	const href = book.section(index).href.split('#')[0];
	const visit = (items: NavItem[]): string | undefined => {
		for (const item of items) {
			if (item.href.split('#')[0] === href) return item.label;
			const nested = visit(item.subitems ?? []);
			if (nested) return nested;
		}
		return undefined;
	};
	return visit(toc);
}

export function cfiToKoreaderXPointer(
	rendition: Rendition,
	cfi: string,
	spineCount: number
): string | null {
	try {
		const range = rendition.getRange(cfi);
		const contents =
			renditionContents(rendition).find(
				(item) => item.document === range.startContainer.ownerDocument
			) ?? null;
		if (!contents) return null;
		return toKoreaderXPointer(
			{ node: range.startContainer, offset: range.startOffset },
			{ spineIndex: contents.sectionIndex, spineCount },
			'forward'
		);
	} catch {
		return null;
	}
}

export function selectionFromCfi(
	contents: Contents,
	cfiRange: string,
	spineCount: number,
	chapter?: string
): SelectionDraft | null {
	const range = contents.range(cfiRange);
	const text = range.toString();
	if (!text.trim()) return null;
	const spine: SpineLocation = { spineIndex: contents.sectionIndex, spineCount };
	const pos0 = toKoreaderXPointer(
		{ node: range.startContainer, offset: range.startOffset },
		spine,
		'forward'
	);
	const pos1 = toKoreaderXPointer(
		{ node: range.endContainer, offset: range.endOffset },
		spine,
		'backward'
	);
	return { page: pos0, pos0, pos1, text, chapter };
}

export function annotationRange(
	contents: Contents,
	annotation: ReaderAnnotation,
	spineCount: number
): Range | null {
	if (xpointerSpineIndex(annotation.page) !== contents.sectionIndex) return null;
	const body = contents.document.body;
	const spine = { spineIndex: contents.sectionIndex, spineCount };
	let start = annotation.pos0 ? fromKoreaderXPointer(annotation.pos0, body, spine) : null;
	let end = annotation.pos1 ? fromKoreaderXPointer(annotation.pos1, body, spine) : null;
	if ((!start || !end) && annotation.text) {
		const recovered = recoverUniqueTextRange(body, annotation.text);
		start = recovered?.start ?? null;
		end = recovered?.end ?? null;
	}
	if (!start || !end) return null;

	const range = contents.document.createRange();
	range.setStart(start.node as Node, start.offset);
	range.setEnd(end.node as Node, end.offset);
	return range;
}

export async function displayKoreaderXPointer(
	rendition: Rendition,
	xpointer: string,
	spineCount: number
): Promise<void> {
	const index = xpointerSpineIndex(xpointer);
	if (index < 0 || index >= spineCount) return;
	await rendition.display(index);
	const contents = renditionContents(rendition).find((item) => item.sectionIndex === index);
	if (!contents) return;
	const point = fromKoreaderXPointer(xpointer, contents.document.body, {
		spineIndex: index,
		spineCount
	});
	if (!point) return;
	const range = contents.document.createRange();
	range.setStart(point.node as Node, point.offset);
	range.collapse(true);
	await rendition.display(contents.cfiFromRange(range));
}
