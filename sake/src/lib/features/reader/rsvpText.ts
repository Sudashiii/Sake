import { EpubCFI } from 'epubjs';
import { toKoreaderXPointer, type DomPoint, type SpineLocation } from './koreaderXPointer';

export interface RsvpWordDisplay {
	prefix: string;
	focus: string;
	suffix: string;
}

export interface RsvpToken {
	text: string;
	coreText: string;
	sectionIndex: number;
	paragraphIndex: number;
	sentenceIndex: number;
	startXPointer: string;
	endXPointer: string;
	startCfi: string;
	percentFinished: number;
	delayMultiplier: number;
	isSentenceEnd: boolean;
	isParagraphEnd: boolean;
	isSectionEnd: boolean;
	startPoint: DomPoint;
	endPoint: DomPoint;
}

export interface RsvpSectionInput {
	document: Document;
	sectionIndex: number;
	spineCount: number;
	sectionCfiBase: string;
	percentFromCfi: (cfi: string) => number;
	language?: string;
}

export interface RsvpSectionTokens {
	sectionIndex: number;
	title: string;
	tokens: RsvpToken[];
}

interface ParagraphText {
	text: string;
	points: DomPoint[];
	paragraphIndex: number;
}

interface WordSegment {
	start: number;
	end: number;
	text: string;
	coreStart: number;
	coreEnd: number;
}

export interface RsvpTextSegment {
	text: string;
	coreText: string;
	start: number;
	end: number;
}

const BLOCK_TAGS = new Set([
	'article', 'aside', 'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure',
	'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'li', 'main', 'nav', 'p',
	'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr'
]);
const EXCLUDED_TAGS = new Set(['head', 'script', 'style', 'noscript', 'template', 'svg', 'math']);
const OPENING_PUNCTUATION = /^[\s\p{Pi}\p{Ps}«‹“‘([{]+$/u;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const SYMBOL_CHARACTER = /^[\p{S}\p{M}\u200d\ufe0f]+$/u;
const SENTENCE_END = /[.!?…][\s\p{Pf}\p{Pe}"'”’»›)\]}]*$/u;
const CLAUSE_END = /[,;:][\s\p{Pf}\p{Pe}"'”’»›)\]}]*$/u;

function normalizedTag(element: Element): string {
	return element.localName?.toLowerCase() ?? element.tagName.toLowerCase();
}

function isExcluded(element: Element): boolean {
	if (EXCLUDED_TAGS.has(normalizedTag(element))) return true;
	if (element.hasAttribute('hidden')) return true;
	if (element.getAttribute('aria-hidden') === 'true') return true;
	const style = element.getAttribute('style')?.replace(/\s/g, '').toLowerCase() ?? '';
	return style.includes('display:none') || style.includes('visibility:hidden');
}

function isVisibleTextNode(node: Text, body: Element): boolean {
	if (isExcluded(body)) return false;
	let current: Element | null = node.parentElement;
	while (current && current !== body) {
		if (isExcluded(current)) return false;
		current = current.parentElement;
	}
	return current === body;
}

function paragraphElement(node: Text, body: Element): Element {
	let current: Element | null = node.parentElement;
	while (current && current !== body) {
		if (BLOCK_TAGS.has(normalizedTag(current))) return current;
		current = current.parentElement;
	}
	return body;
}

function collectParagraphs(body: Element): ParagraphText[] {
	const paragraphs: ParagraphText[] = [];
	const byElement = new Map<Element, ParagraphText>();
	const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT);
	let current: Node | null = walker.nextNode();

	while (current) {
		const textNode = current as Text;
		const value = textNode.nodeValue ?? '';
		const block = paragraphElement(textNode, body);
		if (value.length > 0 && isVisibleTextNode(textNode, body)) {
			let paragraph = byElement.get(block);
			if (!paragraph) {
				paragraph = { text: '', points: [], paragraphIndex: paragraphs.length };
				byElement.set(block, paragraph);
				paragraphs.push(paragraph);
			}

			const startOffset = paragraph.text.length;
			for (let offset = 0; offset < value.length; offset += 1) {
				paragraph.points[startOffset + offset] = { node: textNode, offset };
			}
			paragraph.points[startOffset + value.length] = { node: textNode, offset: value.length };
			paragraph.text += value;
		}
		current = walker.nextNode();
	}

	return paragraphs.filter((paragraph) => paragraph.text.trim().length > 0);
}

function makeSegmenter(
	language: string | undefined,
	granularity: 'word' | 'sentence' | 'grapheme'
): Intl.Segmenter | null {
	if (typeof Intl.Segmenter !== 'function') return null;
	try {
		return new Intl.Segmenter(language, { granularity });
	} catch {
		return new Intl.Segmenter(undefined, { granularity });
	}
}

function isWordSegment(segment: { text: string; isWordLike?: boolean }): boolean {
	return (
		(segment.isWordLike !== false && WORD_CHARACTER.test(segment.text)) ||
		(segment.isWordLike === false && SYMBOL_CHARACTER.test(segment.text))
	);
}

function collectWordSegments(text: string, language: string | undefined): WordSegment[] {
	const segmenter = makeSegmenter(language, 'word');
	const rawSegments = segmenter
		? Array.from(segmenter.segment(text), (entry) => ({
			start: entry.index,
			end: entry.index + entry.segment.length,
			text: entry.segment,
			isWordLike: entry.isWordLike
		}))
		: [...text.matchAll(/\S+/gu)].map((match) => ({
			start: match.index ?? 0,
			end: (match.index ?? 0) + match[0].length,
			text: match[0],
			isWordLike: WORD_CHARACTER.test(match[0]) || SYMBOL_CHARACTER.test(match[0])
		}));

	const segments: WordSegment[] = [];
	let pendingStart: number | null = null;
	let current: WordSegment | null = null;

	for (const segment of rawSegments) {
		if (isWordSegment(segment)) {
			const start = pendingStart ?? segment.start;
			current = {
				start,
				end: segment.end,
				text: text.slice(start, segment.end),
				coreStart: segment.start,
				coreEnd: segment.end
			};
			segments.push(current);
			pendingStart = null;
			continue;
		}

		if (!segment.text.trim()) continue;
		if (OPENING_PUNCTUATION.test(segment.text)) {
			pendingStart = pendingStart ?? segment.start;
			continue;
		}
		if (current) {
			current.end = segment.end;
			current.text = text.slice(current.start, current.end);
		} else {
			pendingStart = pendingStart ?? segment.start;
		}
	}

	return segments;
}

export function segmentRsvpText(text: string, language?: string): RsvpTextSegment[] {
	return collectWordSegments(text, language).map((segment) => ({
		text: segment.text,
		coreText: text.slice(segment.coreStart, segment.coreEnd),
		start: segment.start,
		end: segment.end
	}));
}

function fallbackSentenceIndex(text: string, start: number): number {
	return (text.slice(0, start).match(/[.!?…]+[\s\p{Pf}\p{Pe}"'”’»›)\]}]*/gu) ?? []).length;
}

function sentenceIndexFor(text: string, start: number, language: string | undefined): number {
	const segmenter = makeSegmenter(language, 'sentence');
	if (!segmenter) return fallbackSentenceIndex(text, start);
	let index = 0;
	for (const entry of segmenter.segment(text)) {
		if (entry.index > start) break;
		index += 1;
	}
	return Math.max(0, index - 1);
}

function graphemeCharacters(value: string, language: string | undefined): string[] {
	const segmenter = makeSegmenter(language, 'grapheme');
	return segmenter
		? Array.from(segmenter.segment(value), (entry) => entry.segment)
		: Array.from(value);
}

function focalIndex(value: string, language: string | undefined): number {
	const length = graphemeCharacters(value, language).length;
	if (length <= 1) return 0;
	if (length <= 5) return 1;
	if (length <= 9) return 2;
	if (length <= 13) return 3;
	return 4;
}

function splitCore(value: string, language: string | undefined): RsvpWordDisplay {
	const characters = graphemeCharacters(value, language);
	const focusAt = Math.min(Math.max(0, focalIndex(value, language)), Math.max(0, characters.length - 1));
	return {
		prefix: characters.slice(0, focusAt).join(''),
		focus: characters[focusAt] ?? '',
		suffix: characters.slice(focusAt + 1).join('')
	};
}

export function splitRsvpWord(token: Pick<RsvpToken, 'text' | 'coreText'>, language?: string): RsvpWordDisplay {
	const coreStart = token.text.indexOf(token.coreText);
	if (coreStart < 0) return { prefix: '', focus: token.text, suffix: '' };
	const core = splitCore(token.coreText, language);
	return {
		prefix: token.text.slice(0, coreStart) + core.prefix,
		focus: core.focus,
		suffix: core.suffix + token.text.slice(coreStart + token.coreText.length)
	};
}

function pointAt(paragraph: ParagraphText, offset: number, fallback: 'start' | 'end'): DomPoint {
	if (paragraph.points.length === 0) throw new Error('Paragraph has no DOM points');
	const index = Math.max(0, Math.min(offset, paragraph.points.length - 1));
	return paragraph.points[index] ?? paragraph.points[fallback === 'start' ? 0 : paragraph.points.length - 1];
}

function createRange(document: Document, start: DomPoint, end: DomPoint): Range {
	const range = document.createRange();
	range.setStart(start.node as Node, start.offset);
	range.setEnd(end.node as Node, end.offset);
	return range;
}

function multiplierFor(tokenText: string, isParagraphEnd: boolean, isSectionEnd: boolean): number {
	if (isSectionEnd) return 3;
	if (isParagraphEnd) return 2.25;
	if (SENTENCE_END.test(tokenText)) return 2;
	if (CLAUSE_END.test(tokenText)) return 1.5;
	return 1;
}

export function getRsvpDelayMultiplier(tokenText: string, isParagraphEnd = false, isSectionEnd = false): number {
	return multiplierFor(tokenText, isParagraphEnd, isSectionEnd);
}

export function getRsvpDelayMs(wpm: number, token: Pick<RsvpToken, 'delayMultiplier'>): number {
	const normalizedWpm = Number.isFinite(wpm) && wpm > 0 ? wpm : 300;
	return Math.max(1, Math.round((60_000 / normalizedWpm) * token.delayMultiplier));
}

export function tokenizeRsvpSection(input: RsvpSectionInput): RsvpSectionTokens {
	const body = input.document.querySelector('body') ?? input.document.documentElement;
	const paragraphs = collectParagraphs(body);
	const tokens: RsvpToken[] = [];
	let sentenceOffset = 0;

	for (const paragraph of paragraphs) {
		const segments = collectWordSegments(paragraph.text, input.language);
		for (const segment of segments) {
			const startPoint = pointAt(paragraph, segment.start, 'start');
			const endPoint = pointAt(paragraph, segment.end, 'end');
			const range = createRange(input.document, startPoint, endPoint);
			const startCfi = new EpubCFI(range, input.sectionCfiBase).toString();
			const xpointer = toKoreaderXPointer(
				startPoint,
				{ spineIndex: input.sectionIndex, spineCount: input.spineCount } satisfies SpineLocation,
				'forward'
			);
			const endXPointer = toKoreaderXPointer(
				endPoint,
				{ spineIndex: input.sectionIndex, spineCount: input.spineCount } satisfies SpineLocation,
				'backward'
			);
			const sentenceIndex = sentenceOffset + sentenceIndexFor(paragraph.text, segment.start, input.language);
			const isSentenceEnd = SENTENCE_END.test(segment.text);
			const isParagraphEnd = segment === segments.at(-1);
			const percentFinished = input.percentFromCfi(startCfi);
			tokens.push({
				text: segment.text,
				coreText: paragraph.text.slice(segment.coreStart, segment.coreEnd),
				sectionIndex: input.sectionIndex,
				paragraphIndex: paragraph.paragraphIndex,
				sentenceIndex,
				startXPointer: xpointer,
				endXPointer,
				startCfi,
				percentFinished: Number.isFinite(percentFinished)
					? Math.max(0, Math.min(1, percentFinished))
					: 0,
				delayMultiplier: multiplierFor(segment.text, isParagraphEnd, false),
				isSentenceEnd,
				isParagraphEnd,
				isSectionEnd: false,
				startPoint,
				endPoint
			});
		}
		if (segments.length > 0) {
			sentenceOffset += sentenceIndexFor(paragraph.text, paragraph.text.length, input.language) + 1;
		}
	}

	const last = tokens.at(-1);
	if (last) {
		last.isSectionEnd = true;
		last.delayMultiplier = multiplierFor(last.text, last.isParagraphEnd, true);
	}

	const title = body.querySelector('h1, h2, h3')?.textContent?.trim() || `Section ${input.sectionIndex + 1}`;
	return { sectionIndex: input.sectionIndex, title, tokens };
}
