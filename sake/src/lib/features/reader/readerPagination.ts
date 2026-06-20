import type Book from 'epubjs/types/book';
import type Rendition from 'epubjs/types/rendition';
import type { Location } from 'epubjs/types/rendition';
import {
	applyReaderAppearance,
	registerReaderAppearance,
	type ReaderTheme
} from './readerAppearance';

export interface ReaderPagination {
	sectionPageOffsets: number[];
	totalPages: number;
}

interface MeasureReaderPaginationOptions {
	epubData: ArrayBuffer;
	host: HTMLElement;
	theme: ReaderTheme;
	fontSize: number;
	isCancelled: () => boolean;
}

export async function measureReaderPagination({
	epubData,
	host,
	theme,
	fontSize,
	isCancelled
}: MeasureReaderPaginationOptions): Promise<ReaderPagination | null> {
	const epubModule = await import('epubjs');
	let measurementBook: Book | null = null;
	const measurementHost = document.createElement('div');
	measurementHost.style.width = '100%';
	measurementHost.style.height = '100%';
	host.append(measurementHost);

	try {
		measurementBook = epubModule.default(epubData.slice(0));
		await measurementBook.ready;
		if (isCancelled()) return null;

		const spine = await measurementBook.loaded.spine;
		const rendition = measurementBook.renderTo(measurementHost, {
			width: '100%',
			height: '100%',
			flow: 'paginated',
			spread: 'auto',
			allowScriptedContent: false
		});
		registerReaderAppearance(rendition);
		applyReaderAppearance(rendition, theme, fontSize);

		const sectionPageOffsets: number[] = [];
		let totalPages = 0;
		for (let sectionIndex = 0; sectionIndex < spine.length; sectionIndex += 1) {
			if (isCancelled()) return null;
			sectionPageOffsets.push(totalPages);
			if (spine[sectionIndex]?.linear !== 'yes') continue;
			const location = await displaySection(rendition, sectionIndex);
			totalPages += Math.max(1, location.start.displayed.total);
		}

		return { sectionPageOffsets, totalPages };
	} finally {
		measurementBook?.destroy();
		measurementHost.remove();
	}
}

export function bookPageFromPagination(
	pagination: ReaderPagination,
	sectionIndex: number,
	chapterPage: number
): number | null {
	const sectionOffset = pagination.sectionPageOffsets[sectionIndex];
	if (sectionOffset === undefined || !Number.isFinite(chapterPage) || chapterPage < 1) {
		return null;
	}
	return Math.min(pagination.totalPages, sectionOffset + Math.floor(chapterPage));
}

function displaySection(rendition: Rendition, sectionIndex: number): Promise<Location> {
	return new Promise((resolve, reject) => {
		let isSettled = false;
		const settle = (callback: () => void): void => {
			if (isSettled) return;
			isSettled = true;
			clearTimeout(timeout);
			callback();
		};
		const timeout = setTimeout(
			() => settle(() => reject(new Error(`Timed out paginating EPUB section ${sectionIndex}`))),
			15_000
		);
		rendition.once('relocated', (location: Location) => settle(() => resolve(location)));
		void rendition
			.display(sectionIndex)
			.catch((error: unknown) =>
				settle(() => reject(error instanceof Error ? error : new Error(String(error))))
			);
	});
}
