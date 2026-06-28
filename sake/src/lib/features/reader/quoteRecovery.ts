import type { DomPoint } from './koreaderXPointer';

interface TextSegment {
	node: Text;
	start: number;
	end: number;
}

export interface RecoveredDomRange {
	start: DomPoint;
	end: DomPoint;
}

export function recoverUniqueTextRange(body: HTMLElement, quote: string): RecoveredDomRange | null {
	if (!quote) {
		return null;
	}

	const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT);
	const segments: TextSegment[] = [];
	let combined = '';
	let current = walker.nextNode();
	while (current) {
		const node = current as Text;
		const start = combined.length;
		combined += node.data;
		segments.push({ node, start, end: combined.length });
		current = walker.nextNode();
	}

	const matchIndex = combined.indexOf(quote);
	if (matchIndex < 0 || combined.indexOf(quote, matchIndex + 1) >= 0) {
		return null;
	}

	const endIndex = matchIndex + quote.length;
	const startSegment = segments.find(
		(segment) => matchIndex >= segment.start && matchIndex <= segment.end
	);
	const endSegment = segments.find(
		(segment) => endIndex >= segment.start && endIndex <= segment.end
	);
	if (!startSegment || !endSegment) {
		return null;
	}

	return {
		start: { node: startSegment.node, offset: matchIndex - startSegment.start },
		end: { node: endSegment.node, offset: endIndex - endSegment.start }
	};
}
