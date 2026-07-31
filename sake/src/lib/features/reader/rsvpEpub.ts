import { EpubCFI, type Book } from 'epubjs';
import type Section from 'epubjs/types/section';
import { fromKoreaderXPointer, type DomNodeLike } from './koreaderXPointer';
import { xpointerSpineIndex } from './readerRuntime';
import { tokenizeRsvpSection, type RsvpSectionTokens, type RsvpToken } from './rsvpText';

export interface RsvpSeekPosition {
	xpointer: string | null;
	cfi: string | null;
	percentFinished: number;
	spineIndex: number;
}

interface RsvpBookOptions {
	book: Book;
	spineCount: number;
	language?: string | null;
}

interface LoadedSection {
	data: RsvpSectionTokens;
	document: Document;
	section: Section;
}

function clampPercent(value: number): number {
	return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function cleanHref(value: string): string {
	return value.split('#', 1)[0].replace(/^\.\//, '');
}

function pointRange(document: Document, point: { node: DomNodeLike; offset: number }): Range {
	const range = document.createRange();
	range.setStart(point.node as Node, point.offset);
	range.collapse(true);
	return range;
}

function comparePoints(
	document: Document,
	left: { node: DomNodeLike; offset: number },
	right: { node: DomNodeLike; offset: number }
): number {
	return pointRange(document, left).compareBoundaryPoints(
		Range.START_TO_START,
		pointRange(document, right)
	);
}

function parsedSectionDocument(source: string): Document {
	const parser = new DOMParser();
	let document = parser.parseFromString(source, 'application/xhtml+xml');
	if (document.querySelector('parsererror')) {
		document = parser.parseFromString(source, 'text/html');
	}
	return document;
}

export class RsvpEpubSession {
	private readonly cache = new Map<number, LoadedSection>();
	private readonly maxCachedSections = 3;
	private readonly failedSections = new Set<number>();
	private currentSectionIndex: number | null = null;
	private currentTokenIndex = -1;

	constructor(private readonly options: RsvpBookOptions) {}

	get currentToken(): RsvpToken | null {
		if (this.currentSectionIndex === null) return null;
		return this.cache.get(this.currentSectionIndex)?.data.tokens[this.currentTokenIndex] ?? null;
	}

	get currentChapterTitle(): string {
		if (this.currentSectionIndex === null) return '';
		return this.cache.get(this.currentSectionIndex)?.data.title ?? '';
	}

	async seek(position: RsvpSeekPosition): Promise<RsvpToken | null> {
		const pointerIndex =
			position.xpointer && /^\/body\/DocFragment(?:\[\d+])?\//.test(position.xpointer)
				? xpointerSpineIndex(position.xpointer)
				: null;
		const cfiIndex = position.cfi ? this.spineIndexFromCfi(position.cfi) : null;
		const preferredIndex = Math.max(
			0,
			Math.min(this.options.spineCount - 1, pointerIndex ?? cfiIndex ?? position.spineIndex)
		);

		if (position.xpointer && pointerIndex !== null) {
			const loaded = await this.loadSection(pointerIndex);
			const point = loaded
				? fromKoreaderXPointer(
					position.xpointer,
					loaded.document.querySelector('body') ?? loaded.document.documentElement,
					{ spineIndex: pointerIndex, spineCount: this.options.spineCount }
				)
				: null;
			if (loaded && point) {
				const token = this.tokenAtPoint(loaded, point);
				if (token) return this.setCurrent(loaded, token);
			}
		}

		if (position.cfi) {
			const loaded = await this.loadSection(preferredIndex);
			if (loaded) {
				const token = this.tokenAtCfi(loaded, position.cfi);
				if (token) return this.setCurrent(loaded, token);
			}
		}

		const percent = clampPercent(position.percentFinished);
		if (
			(pointerIndex !== null && this.failedSections.has(pointerIndex)) ||
			(cfiIndex !== null && this.failedSections.has(cfiIndex))
		) {
			return null;
		}
		return this.seekByPercent(percent);
	}

	async seekXPointer(xpointer: string): Promise<RsvpToken | null> {
		return this.seek({ xpointer, cfi: null, percentFinished: 0, spineIndex: xpointerSpineIndex(xpointer) });
	}

	async seekHref(href: string): Promise<RsvpToken | null> {
		const [rawPath, rawFragment] = href.split('#', 2);
		const path = cleanHref(rawPath);
		let index = this.findSectionIndex(path);
		if (index === null) {
			try {
				index = this.options.book.section(href).index;
			} catch {
				index = null;
			}
		}
		if (index === null) return null;

		const loaded = await this.loadSection(index);
		if (!loaded) return null;
		if (rawFragment) {
			const fragment = decodeURIComponent(rawFragment);
			const element = loaded.document.getElementById(fragment);
			if (element) {
				const range = loaded.document.createRange();
				range.selectNodeContents(element);
				const token = this.tokenAtPoint(loaded, {
					node: range.startContainer,
					offset: range.startOffset
				});
				if (token) return this.setCurrent(loaded, token);
			}
		}

		const token = loaded.data.tokens[0] ?? null;
		return token ? this.setCurrent(loaded, token) : this.firstTextToken(index + 1);
	}

	async moveWords(delta: number): Promise<RsvpToken | null> {
		if (!Number.isInteger(delta) || delta === 0) return this.currentToken;
		if (this.currentSectionIndex === null || this.currentTokenIndex < 0) return null;

		let remaining = Math.abs(delta);
		let index = this.currentSectionIndex;
		let tokenIndex = this.currentTokenIndex;
		const direction = delta > 0 ? 1 : -1;

		while (remaining > 0) {
			tokenIndex += direction;
			if (tokenIndex >= 0 && tokenIndex < (this.cache.get(index)?.data.tokens.length ?? 0)) {
				remaining -= 1;
				continue;
			}

			const next = await this.loadTextSection(index + direction, direction);
			if (!next) {
				if (Math.abs(delta) === 1) return direction > 0 ? null : this.currentToken;
				const clampedSection = this.cache.get(index);
				const clamped = clampedSection?.data.tokens[tokenIndex - direction] ?? null;
				return clampedSection && clamped ? this.setCurrent(clampedSection, clamped) : this.currentToken;
			}
			index = next.data.sectionIndex;
			tokenIndex = direction > 0 ? 0 : next.data.tokens.length - 1;
			remaining -= 1;
		}

		const target = this.cache.get(index)?.data.tokens[tokenIndex] ?? null;
		if (!target) return this.currentToken;
		const loaded = this.cache.get(index);
		return loaded ? this.setCurrent(loaded, target) : this.currentToken;
	}

	async moveSentence(direction: 'previous' | 'next'): Promise<RsvpToken | null> {
		if (this.currentSectionIndex === null || this.currentTokenIndex < 0) return null;
		const loaded = this.cache.get(this.currentSectionIndex);
		if (!loaded) return null;
		const current = loaded.data.tokens[this.currentTokenIndex];
		if (!current) return null;

		if (direction === 'next') {
			const next = loaded.data.tokens.find((token) => token.sentenceIndex > current.sentenceIndex);
			if (next) return this.setCurrent(loaded, next);
			return this.firstTextToken(this.currentSectionIndex + 1);
		}

		const previous = [...loaded.data.tokens].reverse().find((token) => token.sentenceIndex < current.sentenceIndex);
		if (previous) return this.setCurrent(loaded, previous);
		return this.lastTextToken(this.currentSectionIndex - 1);
	}

	destroy(): void {
		for (const loaded of this.cache.values()) loaded.section.unload();
		this.cache.clear();
		this.failedSections.clear();
		this.currentSectionIndex = null;
		this.currentTokenIndex = -1;
	}

	private async firstTextToken(startIndex: number): Promise<RsvpToken | null> {
		const loaded = await this.loadTextSection(startIndex, 1);
		const token = loaded?.data.tokens[0] ?? null;
		return loaded && token ? this.setCurrent(loaded, token) : null;
	}

	private async lastTextToken(startIndex: number): Promise<RsvpToken | null> {
		const loaded = await this.loadTextSection(startIndex, -1);
		const token = loaded?.data.tokens.at(-1) ?? null;
		return loaded && token ? this.setCurrent(loaded, token) : null;
	}

	private setCurrent(loaded: LoadedSection, token: RsvpToken): RsvpToken {
		this.currentSectionIndex = loaded.data.sectionIndex;
		this.currentTokenIndex = loaded.data.tokens.indexOf(token);
		this.touchCache(loaded.data.sectionIndex, loaded);
		return token;
	}

	private async seekByPercent(percent: number): Promise<RsvpToken | null> {
		const indexes = Array.from({ length: this.options.spineCount }, (_, index) => index);
		let last: LoadedSection | null = null;
		for (const index of indexes) {
			if (this.failedSections.has(index)) {
				throw new Error('Unable to extract an EPUB section for RSVP mode');
			}
			const loaded = await this.loadSection(index);
			if (this.failedSections.has(index)) {
				throw new Error('Unable to extract an EPUB section for RSVP mode');
			}
			if (!loaded || loaded.data.tokens.length === 0) continue;
			last = loaded;
			const token = loaded.data.tokens.find((candidate) => candidate.percentFinished >= percent);
			if (token) return this.setCurrent(loaded, token);
		}
		const token = last?.data.tokens.at(-1) ?? null;
		return last && token ? this.setCurrent(last, token) : null;
	}

	private tokenAtPoint(loaded: LoadedSection, point: { node: DomNodeLike; offset: number }): RsvpToken | null {
		for (const token of loaded.data.tokens) {
			if (comparePoints(loaded.document, token.endPoint, point) > 0) return token;
		}
		return loaded.data.tokens.at(-1) ?? null;
	}

	private tokenAtCfi(loaded: LoadedSection, cfi: string): RsvpToken | null {
		try {
			const range = new EpubCFI(cfi).toRange(loaded.document);
			return this.tokenAtPoint(loaded, { node: range.startContainer, offset: range.startOffset });
		} catch {
			return null;
		}
	}

	private spineIndexFromCfi(cfi: string): number | null {
		try {
			const index = new EpubCFI(cfi).spinePos;
			return Number.isInteger(index) ? index : null;
		} catch {
			return null;
		}
	}

	private findSectionIndex(path: string): number | null {
		for (let index = 0; index < this.options.spineCount; index += 1) {
			try {
				const section = this.options.book.section(index);
				if (cleanHref(section.href) === path || cleanHref(section.url) === path) return index;
			} catch {
				// Invalid spine entries are skipped.
			}
		}
		return null;
	}

	private async loadTextSection(
		startIndex: number,
		direction: 1 | -1
	): Promise<LoadedSection | null> {
		for (let index = startIndex; index >= 0 && index < this.options.spineCount; index += direction) {
			if (this.failedSections.has(index)) {
				throw new Error('Unable to extract an EPUB section for RSVP mode');
			}
			const loaded = await this.loadSection(index);
			if (this.failedSections.has(index)) {
				throw new Error('Unable to extract an EPUB section for RSVP mode');
			}
			if (loaded && loaded.data.tokens.length > 0) return loaded;
		}
		return null;
	}

	private async loadSection(index: number): Promise<LoadedSection | null> {
		if (index < 0 || index >= this.options.spineCount) return null;
		const cached = this.cache.get(index);
		if (cached) {
			this.touchCache(index, cached);
			return cached;
		}

		let section: Section;
		try {
			section = this.options.book.section(index);
		} catch {
			return null;
		}
		if (section.linear === false) return null;

		try {
			const rendered = await (section.render(this.options.book.load.bind(this.options.book)) as unknown as Promise<string>);
			const document = parsedSectionDocument(rendered);
			const data = tokenizeRsvpSection({
				document,
				sectionIndex: index,
				spineCount: this.options.spineCount,
				sectionCfiBase: section.cfiBase,
				percentFromCfi: (cfi) => {
					try {
						return this.options.book.locations.percentageFromCfi(cfi);
					} catch {
						return 0;
					}
				},
				language: this.options.language ?? undefined
			});
			const loaded = { data, document, section };
			this.touchCache(index, loaded);
			return loaded;
		} catch {
			this.failedSections.add(index);
			return null;
		}
	}

	private touchCache(index: number, loaded: LoadedSection): void {
		this.cache.delete(index);
		this.cache.set(index, loaded);
		while (this.cache.size > this.maxCachedSections) {
			const oldest = this.cache.keys().next().value;
			if (oldest === undefined) break;
			if (oldest === this.currentSectionIndex) {
				const current = this.cache.get(oldest);
				if (current) {
					this.cache.delete(oldest);
					this.cache.set(oldest, current);
				}
				continue;
			}
			const evicted = this.cache.get(oldest);
			this.cache.delete(oldest);
			evicted?.section.unload();
		}
	}
}
