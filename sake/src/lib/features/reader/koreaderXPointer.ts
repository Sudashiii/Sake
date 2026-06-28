const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

export interface DomNodeLike {
	readonly nodeType: number;
	readonly nodeName: string;
	readonly nodeValue: string | null;
	readonly parentNode: DomNodeLike | null;
	readonly childNodes: ArrayLike<DomNodeLike>;
}

export interface DomPoint {
	node: DomNodeLike;
	offset: number;
}

export interface SpineLocation {
	spineIndex: number;
	spineCount: number;
}

type BoundaryAffinity = 'forward' | 'backward';

function childrenOf(node: DomNodeLike): DomNodeLike[] {
	return Array.from(node.childNodes);
}

function normalizedNodeName(node: DomNodeLike): string {
	return node.nodeName.split(':').at(-1)?.toLowerCase() ?? node.nodeName.toLowerCase();
}

function findBody(node: DomNodeLike): DomNodeLike {
	let current: DomNodeLike | null = node.nodeType === ELEMENT_NODE ? node : node.parentNode;

	while (current) {
		if (normalizedNodeName(current) === 'body') {
			return current;
		}
		current = current.parentNode;
	}

	throw new Error('DOM point is outside the EPUB chapter body');
}

function findTextBoundary(node: DomNodeLike, affinity: BoundaryAffinity): DomPoint | null {
	if (node.nodeType === TEXT_NODE) {
		const length = node.nodeValue?.length ?? 0;
		return { node, offset: affinity === 'forward' ? 0 : length };
	}

	const children = childrenOf(node);
	const ordered = affinity === 'forward' ? children : children.toReversed();
	for (const child of ordered) {
		const boundary = findTextBoundary(child, affinity);
		if (boundary) {
			return boundary;
		}
	}

	return null;
}

export function normalizeDomPoint(
	node: DomNodeLike,
	offset: number,
	affinity: BoundaryAffinity
): DomPoint {
	if (node.nodeType === TEXT_NODE) {
		const textLength = node.nodeValue?.length ?? 0;
		if (!Number.isInteger(offset) || offset < 0 || offset > textLength) {
			throw new Error('Text offset is outside the DOM text node');
		}
		return { node, offset };
	}

	if (node.nodeType !== ELEMENT_NODE) {
		throw new Error('Only EPUB element and text DOM points are supported');
	}

	const children = childrenOf(node);
	if (!Number.isInteger(offset) || offset < 0 || offset > children.length) {
		throw new Error('Element offset is outside the DOM element');
	}

	const candidates =
		affinity === 'forward' ? children.slice(offset) : children.slice(0, offset).toReversed();
	for (const candidate of candidates) {
		const boundary = findTextBoundary(candidate, affinity);
		if (boundary) {
			return boundary;
		}
	}

	const parent = node.parentNode;
	if (!parent) {
		throw new Error('DOM point has no text boundary');
	}

	const siblingIndex = childrenOf(parent).indexOf(node);
	return normalizeDomPoint(parent, siblingIndex + (affinity === 'forward' ? 1 : 0), affinity);
}

function segmentFor(node: DomNodeLike): string {
	const parent = node.parentNode;
	if (!parent) {
		throw new Error('Cannot create an XPointer segment without a parent node');
	}

	const isText = node.nodeType === TEXT_NODE;
	const name = isText ? 'text()' : normalizedNodeName(node);
	const matchingSiblings = childrenOf(parent).filter((sibling) =>
		isText
			? sibling.nodeType === TEXT_NODE
			: sibling.nodeType === ELEMENT_NODE && normalizedNodeName(sibling) === name
	);
	const index = matchingSiblings.indexOf(node);
	if (index < 0) {
		throw new Error('DOM node is detached from its parent');
	}

	return matchingSiblings.length > 1 ? `${name}[${index + 1}]` : name;
}

function utf16OffsetToCodePoints(text: string, offset: number): number {
	return Array.from(text.slice(0, offset)).length;
}

function codePointOffsetToUtf16(text: string, offset: number): number {
	if (!Number.isInteger(offset) || offset < 0) {
		throw new Error('Invalid XPointer text offset');
	}

	const codePoints = Array.from(text);
	if (offset > codePoints.length) {
		throw new Error('XPointer text offset is outside the DOM text node');
	}

	return codePoints.slice(0, offset).join('').length;
}

export function toKoreaderXPointer(
	point: DomPoint,
	spine: SpineLocation,
	affinity: BoundaryAffinity
): string {
	if (
		!Number.isInteger(spine.spineIndex) ||
		!Number.isInteger(spine.spineCount) ||
		spine.spineIndex < 0 ||
		spine.spineIndex >= spine.spineCount
	) {
		throw new Error('Invalid EPUB spine location');
	}

	const normalized = normalizeDomPoint(point.node, point.offset, affinity);
	const body = findBody(normalized.node);
	const segments: string[] = [];
	let current: DomNodeLike | null = normalized.node;

	while (current && current !== body) {
		segments.unshift(segmentFor(current));
		current = current.parentNode;
	}

	if (current !== body || normalized.node.nodeType !== TEXT_NODE) {
		throw new Error('Unable to create a text XPointer inside the EPUB chapter body');
	}

	const fragmentIndex = spine.spineCount > 1 ? `[${spine.spineIndex + 1}]` : '';
	const text = normalized.node.nodeValue ?? '';
	const textOffset = utf16OffsetToCodePoints(text, normalized.offset);
	return `/body/DocFragment${fragmentIndex}/body/${segments.join('/')}.${textOffset}`;
}

interface ParsedSegment {
	name: string;
	index: number;
	isText: boolean;
}

function parseSegment(value: string): ParsedSegment {
	const match = value.match(/^(text\(\)|[A-Za-z_][\w:.-]*)(?:\[(\d+)])?$/);
	if (!match) {
		throw new Error(`Unsupported KOReader XPointer segment: ${value}`);
	}

	return {
		name: match[1].toLowerCase(),
		index: Number.parseInt(match[2] ?? '1', 10),
		isText: match[1].toLowerCase() === 'text()'
	};
}

export function fromKoreaderXPointer(
	xpointer: string,
	body: DomNodeLike,
	spine: SpineLocation
): DomPoint | null {
	const match = xpointer.match(
		/^\/body\/DocFragment(?:\[(\d+)])?\/body\/(.+)\.(\d+)$/
	);
	if (!match) {
		return null;
	}

	const fragmentIndex = Number.parseInt(match[1] ?? '1', 10) - 1;
	if (fragmentIndex !== spine.spineIndex || spine.spineCount < 1) {
		return null;
	}

	const pathSegments = match[2].split('/').map(parseSegment);
	let current = body;

	for (const segment of pathSegments) {
		const matches = childrenOf(current).filter((child) =>
			segment.isText
				? child.nodeType === TEXT_NODE
				: child.nodeType === ELEMENT_NODE && normalizedNodeName(child) === segment.name
		);
		const next = matches[segment.index - 1];
		if (!next) {
			return null;
		}
		current = next;
	}

	if (current.nodeType !== TEXT_NODE) {
		return null;
	}

	try {
		return {
			node: current,
			offset: codePointOffsetToUtf16(current.nodeValue ?? '', Number.parseInt(match[3], 10))
		};
	} catch {
		return null;
	}
}
