<script lang="ts">
	import { onMount } from 'svelte';
	import type Book from 'epubjs/types/book';
	import type Contents from 'epubjs/types/contents';
	import type { NavItem } from 'epubjs/types/navigation';
	import type Rendition from 'epubjs/types/rendition';
	import type { Location } from 'epubjs/types/rendition';
	import BookOpenIcon from '$lib/assets/icons/BookOpenIcon.svelte';
	import BookmarkPlusIcon from '$lib/assets/icons/BookmarkPlusIcon.svelte';
	import ChevronLeftIcon from '$lib/assets/icons/ChevronLeftIcon.svelte';
	import ChevronRightIcon from '$lib/assets/icons/ChevronRightIcon.svelte';
	import MenuIcon from '$lib/assets/icons/MenuIcon.svelte';
	import RsvpReader from '$lib/features/reader/components/RsvpReader.svelte';
	import ReaderSidebar from '$lib/features/reader/components/ReaderSidebar.svelte';
	import {
		applyReaderAppearance,
		parseReaderTheme,
		registerReaderAppearance,
		type ReaderTheme
	} from '$lib/features/reader/readerAppearance';
	import {
		DEFAULT_TAP_NAVIGATION_DELAY_MS,
		loadReaderNavigationPreferences,
		saveReaderNavigationPreferences
	} from '$lib/features/reader/readerPreferences';
	import { bookPageFromLocation } from '$lib/features/reader/readerPagination';
	import {
		formatReaderFooterStatus,
		loadReaderFooterStatusMode,
		nextReaderFooterStatusMode,
		readerFooterStatusModeLabel,
		saveReaderFooterStatusMode,
		type ReaderBookPaginationStatus,
		type ReaderFooterStatusMode
	} from '$lib/features/reader/readerFooterStatus';
	import {
		createAnnotationId,
		type ReaderAnnotation
	} from '$lib/koreader/koreaderSidecar';
	import {
		fetchKoreaderSidecar,
		koreaderDateTime
	} from '$lib/features/reader/koreaderSidecarClient';
	import {
		annotationRange,
		cfiToKoreaderXPointer,
		chapterFor,
		displayKoreaderXPointer,
		renditionContents,
		selectionFromCfi,
		xpointerSpineIndex,
		type SelectionDraft
	} from '$lib/features/reader/readerRuntime';
	import { ReaderSaveQueue } from '$lib/features/reader/readerSaveQueue';
	import { createReaderSessionId } from '$lib/features/reader/readerSessionId';
	import { startReaderWakeLock } from '$lib/features/reader/readerWakeLock';
	import { RsvpEpubSession } from '$lib/features/reader/rsvpEpub';
	import { RsvpPlaybackController } from '$lib/features/reader/rsvpPlayback';
	import {
		DEFAULT_RSVP_AUTO_ANNOTATE_LAST_WORD,
		DEFAULT_RSVP_SHOW_GUIDE_LINE,
		DEFAULT_RSVP_TEXT_SCALE,
		DEFAULT_RSVP_WPM,
		clampRsvpTextScale,
		clampRsvpWpm,
		loadRsvpPreferences,
		saveRsvpPreferences
	} from '$lib/features/reader/rsvpPreferences';
	import type { RsvpToken } from '$lib/features/reader/rsvpText';
	import {
		ReaderTapNavigation,
		type ReaderTapDiagnostic
	} from '$lib/features/reader/readerTapNavigation';
	import { bindRenditionTapNavigation } from '$lib/features/reader/readerTapNavigationBinding';
	import { getAnnotation } from '$lib/client/routes/annotations';
	import type { AnnotationHubItem } from '$lib/types/Annotations/Annotation';
	import styles from './page.module.scss';

	const { data } = $props();

	let viewportShell = $state<HTMLDivElement | null>(null);
	let viewport = $state<HTMLDivElement | null>(null);
	let book: Book | null = null;
	let rendition: Rendition | null = null;
	let readerMode = $state<'paged' | 'rsvp'>('paged');
	let spineCount = 1;
	let toc = $state<NavItem[]>([]);
	let annotations = $state<ReaderAnnotation[]>([]);
	let currentXPointer = $state<string | null>(null);
	let currentCfi = $state<string | null>(null);
	let currentSpineIndex = $state(0);
	let percentFinished = $state(0);
	let bookPaginationStatus = $state<ReaderBookPaginationStatus>('pending');
	let bookPage = $state<number | null>(null);
	let bookTotalPages = $state<number | null>(null);
	let chapterPage = $state<number | null>(null);
	let chapterTotalPages = $state<number | null>(null);
	let footerStatusMode = $state<ReaderFooterStatusMode>('percentage');
	let currentTime = $state(new Date());
	let isLoading = $state(true);
	let isSaving = $state(false);
	let saveError = $state<string | null>(null);
	let sidebarOpen = $state(false);
	let sidebarTab = $state<'contents' | 'annotations' | 'settings'>('contents');
	let theme = $state<ReaderTheme>('paper');
	let fontSize = $state(100);
	let isTapNavigationEnabled = $state(true);
	let arePageControlsHidden = $state(false);
	let isTapNavigationDebugEnabled = $state(false);
	let tapNavigationDelayMs = $state(DEFAULT_TAP_NAVIGATION_DELAY_MS);
	let tapDiagnostic = $state('Waiting for a tap');
	let rsvpWpm = $state(DEFAULT_RSVP_WPM);
	let rsvpTextScale = $state(DEFAULT_RSVP_TEXT_SCALE);
	let rsvpShowGuideLine = $state(DEFAULT_RSVP_SHOW_GUIDE_LINE);
	let rsvpAutoAnnotateLastWord = $state(DEFAULT_RSVP_AUTO_ANNOTATE_LAST_WORD);
	let rsvpToken = $state<RsvpToken | null>(null);
	let rsvpChapterTitle = $state('');
	let rsvpIsPlaying = $state(false);
	let rsvpIsLoading = $state(false);
	let rsvpIsCompleted = $state(false);
	let rsvpError = $state<string | null>(null);
	let deepLinkWarning = $state<string | null>(null);
	let rsvpSession: RsvpEpubSession | null = null;

	async function loadDeepLinkedAnnotation(): Promise<AnnotationHubItem | null> {
		const rawId = new URLSearchParams(window.location.search).get('annotationId');
		if (rawId === null) return null;
		const id = Number(rawId);
		if (!Number.isInteger(id) || id <= 0) {
			deepLinkWarning = 'This annotation link is invalid. Your saved reading position was opened instead.';
			return null;
		}
		const result = await getAnnotation(id);
		if (!result.ok || result.value.book.id !== data.book.bookId) {
			deepLinkWarning = 'This annotation is no longer available. Your saved reading position was opened instead.';
			return null;
		}
		return result.value;
	}
	let rsvpPlayback: RsvpPlaybackController | null = null;
	let rsvpCheckpointTimer: ReturnType<typeof setInterval> | null = null;
	let restoringRsvpPosition: {
		xpointer: string | null;
		cfi: string | null;
		percentFinished: number;
		spineIndex: number;
	} | null = null;
	let selectionDraft = $state<SelectionDraft | null>(null);
	let noteDraft = $state('');
	let highlightColor = $state('yellow');
	let rsvpEntryOverride = $state<{ xpointer: string; spineIndex: number } | null>(null);
	let unbindTapNavigation: (() => void) | null = null;
	let lastRsvpAnnotationKey: string | null = null;
	let footerStatus = $derived(
		formatReaderFooterStatus(footerStatusMode, {
			percentFinished,
			bookPaginationStatus,
			bookPage,
			bookTotalPages,
			chapterPage,
			chapterTotalPages,
			now: currentTime
		})
	);
	let nextFooterStatusLabel = $derived(
		readerFooterStatusModeLabel(nextReaderFooterStatusMode(footerStatusMode))
	);
	const renderedAnnotationCfis = new Map<string, string>();
	const readerSessionId = createReaderSessionId();
	const tapNavigation = new ReaderTapNavigation(
		(direction) => {
			if (!rendition) return;
			void (direction === 'previous' ? rendition.prev() : rendition.next());
		},
		{ onDiagnostic: handleTapDiagnostic }
	);
	const saveQueue = new ReaderSaveQueue(
		data.book.fileName,
		readerSessionId,
		() => ({ percentFinished, lastXPointer: currentXPointer }),
		(snapshot) => (annotations = snapshot.annotations),
		(status) => {
			isSaving = status.isSaving;
			saveError = status.error;
		}
	);

	function stopRsvpCheckpointTimer(): void {
		if (rsvpCheckpointTimer) {
			clearInterval(rsvpCheckpointTimer);
			rsvpCheckpointTimer = null;
		}
	}

	function startRsvpCheckpointTimer(): void {
		stopRsvpCheckpointTimer();
		rsvpCheckpointTimer = setInterval(() => void saveQueue.flush(), 10_000);
	}

	function handleRsvpToken(token: RsvpToken): void {
		rsvpToken = token;
		rsvpChapterTitle = rsvpSession?.currentChapterTitle ?? '';
		currentXPointer = token.startXPointer;
		currentCfi = token.startCfi;
		currentSpineIndex = token.sectionIndex;
		percentFinished = Math.max(0, Math.min(1, token.percentFinished));
		chapterPage = null;
		chapterTotalPages = null;
		const fallbackLocation = Math.floor(percentFinished * Math.max(0, (bookTotalPages ?? 1) - 1));
		bookPage = bookPageFromLocation(bookTotalPages ?? 0, fallbackLocation);
		rsvpIsCompleted = false;
		rsvpError = null;
	}

	function handleRsvpPlayingChange(isPlaying: boolean): void {
		rsvpIsPlaying = isPlaying;
		if (isPlaying) {
			startRsvpCheckpointTimer();
		} else {
			stopRsvpCheckpointTimer();
			void saveQueue.flush();
		}
	}

	function handleRsvpCompleted(): void {
		rsvpIsCompleted = true;
		percentFinished = 1;
		stopRsvpCheckpointTimer();
		void saveQueue.flush();
	}

	function handleRsvpError(error: unknown): void {
		rsvpError = error instanceof Error ? error.message : 'RSVP playback failed';
		rsvpIsPlaying = false;
		stopRsvpCheckpointTimer();
		void saveQueue.flush();
	}

	function initializeRsvpSession(): void {
		if (!book) return;
		const session = new RsvpEpubSession({
			book,
			spineCount,
			language: document.documentElement.lang || navigator.language
		});
		rsvpSession = session;
		rsvpPlayback = new RsvpPlaybackController(
			{
				moveWords: (delta) => session.moveWords(delta),
				moveSentence: (direction) => session.moveSentence(direction)
			},
			{
				onToken: handleRsvpToken,
				onPlayingChange: handleRsvpPlayingChange,
				onCompleted: handleRsvpCompleted,
				onError: handleRsvpError
			},
			undefined,
			rsvpWpm
		);
	}

	async function enterRsvp(explicitEntry?: { xpointer: string; spineIndex: number }): Promise<void> {
		if (!book || !rsvpSession || !rsvpPlayback || readerMode === 'rsvp' || isLoading) return;
		tapNavigation.cancel();
		sidebarOpen = false;
		rsvpError = null;
		rsvpIsLoading = true;
		try {
			const entry = explicitEntry ?? rsvpEntryOverride;
			const token = await rsvpSession.seek({
				xpointer: entry?.xpointer ?? currentXPointer,
				cfi: entry ? null : currentCfi,
				percentFinished,
				spineIndex: entry?.spineIndex ?? currentSpineIndex
			});
			if (!token) throw new Error('No readable text was found for RSVP mode');
			rsvpEntryOverride = null;
			readerMode = 'rsvp';
			rsvpIsCompleted = false;
			rsvpPlayback.setToken(token);
			await saveQueue.flush();
		} catch (error: unknown) {
			rsvpError = error instanceof Error ? error.message : 'Failed to prepare RSVP mode';
		} finally {
			rsvpIsLoading = false;
		}
	}

	async function startRsvpFromSelection(): Promise<void> {
		const selection = selectionDraft;
		if (!selection) return;
		await enterRsvp({
			xpointer: selection.pos0,
			spineIndex: xpointerSpineIndex(selection.pos0)
		});
		if (readerMode === 'rsvp') selectionDraft = null;
	}

	async function exitRsvp(): Promise<void> {
		if (readerMode !== 'rsvp') return;
		const target = {
			xpointer: currentXPointer,
			cfi: currentCfi,
			percentFinished,
			spineIndex: currentSpineIndex
		};
		annotateRsvpLastWord();
		rsvpPlayback?.pause();
		await saveQueue.flush();
		readerMode = 'paged';
		rsvpError = null;
		restoringRsvpPosition = target;
		try {
			if (target.xpointer) {
				await restoreXPointer(target.xpointer);
			} else if (target.cfi && rendition) {
				await rendition.display(target.cfi);
			}
			renderVisibleAnnotations();
		} finally {
			if (restoringRsvpPosition === target) restoringRsvpPosition = null;
		}
	}

	async function toggleRsvpPlayback(): Promise<void> {
		if (!rsvpPlayback || rsvpError) return;
		if (rsvpIsCompleted && rsvpSession) {
			const first = await rsvpSession.seek({
				xpointer: null,
				cfi: null,
				percentFinished: 0,
				spineIndex: 0
			});
			if (first) {
				rsvpIsCompleted = false;
				rsvpPlayback.setToken(first);
			}
		}
		if (rsvpPlayback.isPlaying) {
			rsvpPlayback.pause();
		} else {
			rsvpPlayback.play();
		}
	}

	async function jumpRsvpWords(delta: number): Promise<void> {
		if (!rsvpPlayback) return;
		rsvpIsCompleted = false;
		await rsvpPlayback.moveWords(delta);
		await saveQueue.flush();
	}

	async function jumpRsvpSentence(direction: 'previous' | 'next'): Promise<void> {
		if (!rsvpPlayback) return;
		rsvpIsCompleted = false;
		await rsvpPlayback.moveSentence(direction);
		await saveQueue.flush();
	}

	function persistRsvpPreferences(): void {
		saveRsvpPreferences(localStorage, {
			wpm: rsvpWpm,
			textScale: rsvpTextScale,
			showGuideLine: rsvpShowGuideLine,
			autoAnnotateLastWord: rsvpAutoAnnotateLastWord
		});
	}

	function updateRsvpWpm(value: number): void {
		rsvpWpm = clampRsvpWpm(value);
		persistRsvpPreferences();
		rsvpPlayback?.setWpm(rsvpWpm);
	}

	function updateRsvpTextScale(value: number): void {
		rsvpTextScale = clampRsvpTextScale(value);
		persistRsvpPreferences();
	}

	function updateRsvpShowGuideLine(show: boolean): void {
		rsvpShowGuideLine = show;
		persistRsvpPreferences();
	}

	function updateRsvpAutoAnnotateLastWord(enabled: boolean): void {
		rsvpAutoAnnotateLastWord = enabled;
		persistRsvpPreferences();
	}

	function annotateRsvpLastWord(): boolean {
		const token = rsvpToken;
		if (readerMode !== 'rsvp' || !rsvpAutoAnnotateLastWord || !token) return false;
		const page = token.startXPointer || currentXPointer;
		if (!page) return false;
		const annotationKey = `${page}\u001f${token.text}`;
		if (lastRsvpAnnotationKey === annotationKey) return false;

		const datetime = koreaderDateTime();
		const note = `RSVP last word: ${token.text}`;
		const legacyBookmark = annotations.find(
			(item) =>
				item.kind === 'bookmark' &&
				item.page === page &&
				item.text === token.text &&
				item.note === note
		);
		const base = {
			kind: 'highlight' as const,
			page,
			pos0: page,
			pos1: token.endXPointer,
			text: token.text,
			note,
			chapter: rsvpChapterTitle || undefined,
			drawer: 'lighten',
			color: 'yellow',
			datetime,
			datetimeUpdated: datetime
		};
		const annotation: ReaderAnnotation = { ...base, id: createAnnotationId(base) };
		annotations = [
			...annotations.filter(
				(item) => item.id !== annotation.id && item.id !== legacyBookmark?.id
			),
			annotation
		];
		if (legacyBookmark) saveQueue.delete(legacyBookmark.id);
		saveQueue.upsert(annotation);
		lastRsvpAnnotationKey = annotationKey;
		return true;
	}

	function openSidebar(): void {
		if (readerMode === 'rsvp') rsvpPlayback?.pause();
		sidebarOpen = true;
	}

	async function navigateToc(href: string): Promise<void> {
		sidebarOpen = false;
		if (readerMode === 'rsvp' && rsvpSession && rsvpPlayback) {
			rsvpPlayback.pause();
			rsvpError = null;
			const token = await rsvpSession.seekHref(href);
			if (!token) {
				rsvpError = 'This section has no readable text for RSVP mode';
				return;
			}
			rsvpPlayback.setToken(token);
			await saveQueue.flush();
			return;
		}
		await rendition?.display(href);
	}

	function applyAppearance(): void {
		if (!rendition) {
			return;
		}
		applyReaderAppearance(rendition, theme, fontSize);
		localStorage.setItem('readerTheme', theme);
		localStorage.setItem('readerFontSize', String(fontSize));
	}

	function updateNavigationPreferences(): void {
		tapNavigation.setEnabled(isTapNavigationEnabled);
		tapNavigation.setDebugEnabled(isTapNavigationDebugEnabled);
		tapNavigation.setNavigationDelay(tapNavigationDelayMs);
		saveReaderNavigationPreferences(localStorage, {
			isTapNavigationEnabled,
			arePageControlsHidden,
			isTapNavigationDebugEnabled,
			tapNavigationDelayMs
		});
	}

	function handleTapDiagnostic(diagnostic: ReaderTapDiagnostic): void {
		tapDiagnostic = formatTapDiagnostic(diagnostic);
		console.info('[Sake reader tap navigation]', diagnostic.type, diagnostic);
	}

	function formatTapDiagnostic(diagnostic: ReaderTapDiagnostic): string {
		switch (diagnostic.type) {
			case 'gesture-start':
				return `${diagnostic.source} started at ${Math.round(diagnostic.x)}px`;
			case 'gesture-moved':
				return `Ignored: moved ${diagnostic.distance}px`;
			case 'gesture-end':
				return diagnostic.isTap
					? `Tap ended after ${diagnostic.duration}ms`
					: `Gesture ended after ${diagnostic.duration}ms`;
			case 'tap-rejected':
				return `Ignored: ${diagnostic.reason.replaceAll('-', ' ')}`;
			case 'tap-scheduled':
				return `Scheduled ${diagnostic.direction} at ${Math.round(diagnostic.x)}px`;
			case 'tap-center':
				return `Center zone at ${Math.round(diagnostic.x)}px`;
			case 'tap-cancelled':
				return `Cancelled: ${diagnostic.reason}`;
			case 'navigate':
				return `Turning ${diagnostic.direction}`;
		}
	}

	function renderAnnotation(annotation: ReaderAnnotation, contents: Contents): void {
		if (!rendition || annotation.kind !== 'highlight' || renderedAnnotationCfis.has(annotation.id)) {
			return;
		}
		if (xpointerSpineIndex(annotation.page) !== contents.sectionIndex) {
			return;
		}

		const range = annotationRange(contents, annotation, spineCount);
		if (!range) return;
		const cfi = contents.cfiFromRange(range);
		rendition.annotations.highlight(
			cfi,
			{ annotationId: annotation.id },
			undefined,
			'sake-reader-highlight',
			{ fill: annotation.color ?? 'yellow', 'fill-opacity': '0.32' }
		);
		renderedAnnotationCfis.set(annotation.id, cfi);
	}

	function renderVisibleAnnotations(): void {
		for (const contents of renditionContents(rendition)) {
			for (const annotation of annotations) {
				renderAnnotation(annotation, contents);
			}
		}
	}

	async function restoreXPointer(xpointer: string): Promise<void> {
		if (rendition) await displayKoreaderXPointer(rendition, xpointer, spineCount);
	}

	function handleRelocated(location: Location): void {
		if (!book || !rendition) {
			return;
		}
		if (readerMode === 'rsvp' && !restoringRsvpPosition) {
			return;
		}
		currentXPointer = cfiToKoreaderXPointer(rendition, location.start.cfi, spineCount);
		currentCfi = location.start.cfi;
		currentSpineIndex = location.start.index;
		const calculated = book.locations.percentageFromCfi(location.start.cfi);
		percentFinished = Number.isFinite(calculated)
			? calculated
			: Math.max(0, Math.min(1, location.start.percentage ?? 0));
		chapterPage = location.start.displayed.page;
		chapterTotalPages = location.start.displayed.total;
		const fallbackLocation = Math.floor(percentFinished * Math.max(0, (bookTotalPages ?? 1) - 1));
		bookPage = bookPageFromLocation(
			bookTotalPages ?? 0,
			location.start.location >= 0 ? location.start.location : fallbackLocation
		);
		const exactPosition = restoringRsvpPosition;
		if (exactPosition) {
			currentXPointer = exactPosition.xpointer;
			currentCfi = exactPosition.cfi;
			currentSpineIndex = exactPosition.spineIndex;
			percentFinished = exactPosition.percentFinished;
		}
		if (rsvpEntryOverride && currentXPointer !== rsvpEntryOverride.xpointer && !exactPosition) {
			rsvpEntryOverride = null;
		}
		renderVisibleAnnotations();
		if (!exactPosition) saveQueue.schedule();
	}

	function cycleFooterStatus(): void {
		const nextMode = nextReaderFooterStatusMode(footerStatusMode);
		footerStatusMode = nextMode;
		saveReaderFooterStatusMode(localStorage, footerStatusMode);
	}

	function handleSelection(cfiRange: string, contents: Contents): void {
		tapNavigation.cancel();
		selectionDraft = selectionFromCfi(
			contents,
			cfiRange,
			spineCount,
			book ? chapterFor(book, toc, contents.sectionIndex) : undefined
		);
		noteDraft = '';
		highlightColor = 'yellow';
	}

	function saveSelection(): void {
		if (!selectionDraft) {
			return;
		}
		const datetime = koreaderDateTime();
		const base = {
			kind: 'highlight' as const,
			...selectionDraft,
			note: noteDraft.trim() || undefined,
			drawer: 'lighten',
			color: highlightColor,
			datetime,
			datetimeUpdated: datetime
		};
		const annotation: ReaderAnnotation = { ...base, id: createAnnotationId(base) };
		annotations = [...annotations.filter((item) => item.id !== annotation.id), annotation];
		rsvpEntryOverride = {
			xpointer: annotation.pos0 ?? annotation.page,
			spineIndex: xpointerSpineIndex(annotation.pos0 ?? annotation.page)
		};
		saveQueue.upsert(annotation);
		selectionDraft = null;
		renderVisibleAnnotations();
		saveQueue.schedule(0);
	}

	function addBookmark(): void {
		if (!currentXPointer) {
			return;
		}
		const datetime = koreaderDateTime();
		const base = {
			kind: 'bookmark' as const,
			page: currentXPointer,
			chapter: book ? chapterFor(book, toc, xpointerSpineIndex(currentXPointer)) : undefined,
			datetime,
			datetimeUpdated: datetime
		};
		const annotation: ReaderAnnotation = { ...base, id: createAnnotationId(base) };
		annotations = [...annotations, annotation];
		saveQueue.upsert(annotation);
		saveQueue.schedule(0);
	}

	function deleteAnnotation(annotation: ReaderAnnotation): void {
		const cfi = renderedAnnotationCfis.get(annotation.id);
		if (cfi && rendition) {
			rendition.annotations.remove(cfi, 'highlight');
		}
		renderedAnnotationCfis.delete(annotation.id);
		if (rsvpEntryOverride?.xpointer === (annotation.pos0 ?? annotation.page)) {
			rsvpEntryOverride = null;
		}
		saveQueue.delete(annotation.id);
		annotations = annotations.filter((item) => item.id !== annotation.id);
		saveQueue.schedule(0);
	}

	async function navigateAnnotation(annotation: ReaderAnnotation): Promise<void> {
		sidebarOpen = false;
		if (readerMode === 'rsvp' && rsvpSession && rsvpPlayback) {
			rsvpPlayback.pause();
			rsvpError = null;
			const token = await rsvpSession.seekXPointer(annotation.pos0 ?? annotation.page);
			if (!token) {
				rsvpError = 'This annotation cannot be located in RSVP mode';
				return;
			}
			rsvpPlayback.setToken(token);
			await saveQueue.flush();
			return;
		}
		await restoreXPointer(annotation.pos0 ?? annotation.page);
	}

	onMount(() => {
		let isDestroyed = false;
		let clockTimer: ReturnType<typeof setTimeout> | null = null;
		const stopWakeLock = startReaderWakeLock();
		const handleVisibilityChange = (): void => {
			if (document.visibilityState === 'hidden') {
				annotateRsvpLastWord();
				rsvpPlayback?.pause();
				void saveQueue.flush();
			}
		};
		const handlePageHide = (): void => {
			annotateRsvpLastWord();
			rsvpPlayback?.pause();
			void saveQueue.flush();
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pagehide', handlePageHide);

		const updateClock = (): void => {
			currentTime = new Date();
			const delayUntilNextMinute = 60_050 - (Date.now() % 60_000);
			clockTimer = setTimeout(updateClock, delayUntilNextMinute);
		};

		updateClock();
		void (async () => {
			try {
				theme = parseReaderTheme(localStorage.getItem('readerTheme'));
				fontSize = Number.parseInt(localStorage.getItem('readerFontSize') ?? '100', 10);
				({
					wpm: rsvpWpm,
					textScale: rsvpTextScale,
					showGuideLine: rsvpShowGuideLine,
					autoAnnotateLastWord: rsvpAutoAnnotateLastWord
				} = loadRsvpPreferences(localStorage));
				footerStatusMode = loadReaderFooterStatusMode(localStorage);
				({
					isTapNavigationEnabled,
					arePageControlsHidden,
					isTapNavigationDebugEnabled,
					tapNavigationDelayMs
				} =
					loadReaderNavigationPreferences(localStorage));
				tapNavigation.setEnabled(isTapNavigationEnabled);
				tapNavigation.setDebugEnabled(isTapNavigationDebugEnabled);
				tapNavigation.setNavigationDelay(tapNavigationDelayMs);
				const [contentResponse, sidecar, epubModule, deepLinkedAnnotation] = await Promise.all([
					fetch(`/api/library/${data.book.bookId}/content`),
					fetchKoreaderSidecar(data.book.fileName),
					import('epubjs'),
					loadDeepLinkedAnnotation()
				]);
				if (!contentResponse.ok) {
					throw new Error('Failed to load EPUB content');
				}
				const epubData = await contentResponse.arrayBuffer();
				book = epubModule.default(epubData.slice(0));
				await book.ready;
				const spine = await book.loaded.spine;
				spineCount = Math.max(1, spine.length);
				toc = (await book.loaded.navigation).toc;
				annotations = sidecar?.annotations ?? [];
				percentFinished = sidecar?.percentFinished ?? 0;
				await book.locations.generate(1200);
				bookTotalPages = book.locations.length();
				bookPaginationStatus = bookTotalPages > 0 ? 'ready' : 'unavailable';
				initializeRsvpSession();
				bookPage = bookPageFromLocation(
					bookTotalPages,
					Math.floor(percentFinished * Math.max(0, bookTotalPages - 1))
				);
				if (isDestroyed || !viewport) {
					return;
				}

				rendition = book.renderTo(viewport, {
					width: '100%',
					height: '100%',
					flow: 'paginated',
					spread: 'auto',
					allowScriptedContent: false
				});
				registerReaderAppearance(rendition);
				rendition.on('relocated', handleRelocated);
				rendition.on('selected', handleSelection);
				rendition.on('rendered', renderVisibleAnnotations);
				unbindTapNavigation = bindRenditionTapNavigation(rendition, tapNavigation, {
					getReaderRect: () => viewportShell?.getBoundingClientRect() ?? null
				});
				applyAppearance();
				if (deepLinkedAnnotation) {
					await restoreXPointer(deepLinkedAnnotation.pos0 ?? deepLinkedAnnotation.page);
				} else if (sidecar?.lastXPointer) {
					await restoreXPointer(sidecar.lastXPointer);
				} else if (sidecar && percentFinished > 0) {
					await rendition.display(book.locations.cfiFromPercentage(percentFinished));
				} else {
					await rendition.display();
				}
			} catch (error: unknown) {
				saveError = error instanceof Error ? error.message : 'Failed to open this EPUB';
			} finally {
				isLoading = false;
			}
		})();

		return () => {
			isDestroyed = true;
			annotateRsvpLastWord();
			stopWakeLock();
			if (clockTimer) clearTimeout(clockTimer);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pagehide', handlePageHide);
			stopRsvpCheckpointTimer();
			rsvpPlayback?.destroy();
			rsvpSession?.destroy();
			saveQueue.destroy();
			unbindTapNavigation?.();
			rendition?.destroy();
			book?.destroy();
		};
	});
</script>

<svelte:head><title>{data.book.title} · Reader</title></svelte:head>

<div class={styles.reader}>
	<header class={styles.toolbar}>
		<div class={styles.toolbarGroup}>
			<button aria-label="Open reader tools" onclick={openSidebar}><MenuIcon size={20} decorative={true} /></button>
			<a href="/library" aria-label="Back to library"><ChevronLeftIcon size={20} decorative={true} /></a>
		</div>
		<div class={styles.title}>
			<strong>{data.book.title}</strong>
			<span>{data.book.author || 'Unknown author'}</span>
		</div>
		<div class={styles.toolbarGroup}>
			<button class={styles.modeButton} aria-label={readerMode === 'rsvp' ? 'Switch to Page View' : 'Switch to RSVP mode'} onclick={() => void (readerMode === 'rsvp' ? exitRsvp() : enterRsvp())} disabled={isLoading || rsvpIsLoading}>
				{readerMode === 'rsvp' ? 'Page' : 'RSVP'}
			</button>
			<span class={styles.saveStatus}>{saveError ? 'Not saved' : isSaving ? 'Saving…' : 'Saved'}</span>
			<button aria-label="Add bookmark" onclick={addBookmark}><BookmarkPlusIcon size={20} decorative={true} /></button>
		</div>
	</header>

	<div bind:this={viewportShell} class={styles.viewportShell}>
		{#if isLoading}
			<div class={styles.loading}><BookOpenIcon size={30} decorative={true} /><span>Opening book…</span></div>
		{/if}
		<div bind:this={viewport} class={`${styles.viewport} ${readerMode === 'rsvp' ? styles.hiddenViewport : ''}`}></div>
		{#if readerMode === 'rsvp'}
			<RsvpReader
				token={rsvpToken}
				isPlaying={rsvpIsPlaying}
				isCompleted={rsvpIsCompleted}
				isLoading={rsvpIsLoading}
				wpm={rsvpWpm}
				textScale={rsvpTextScale}
				showGuideLine={rsvpShowGuideLine}
				autoAnnotateLastWord={rsvpAutoAnnotateLastWord}
				percentFinished={percentFinished}
				chapterTitle={rsvpChapterTitle}
				{theme}
				error={rsvpError}
				onTogglePlay={() => void toggleRsvpPlayback()}
				onJumpWords={(delta) => void jumpRsvpWords(delta)}
				onJumpSentence={(direction) => void jumpRsvpSentence(direction)}
				onWpmChange={updateRsvpWpm}
				onTextScaleChange={updateRsvpTextScale}
				onShowGuideLineChange={updateRsvpShowGuideLine}
				onAutoAnnotateLastWordChange={updateRsvpAutoAnnotateLastWord}
				onExit={() => void exitRsvp()}
			/>
		{/if}
		{#if readerMode === 'paged' && isTapNavigationDebugEnabled}
			<div class={styles.tapZones} aria-hidden="true">
				<div class={styles.previousZone}><span>Previous</span></div>
				<div class={styles.centerZone}><span>No navigation</span></div>
				<div class={styles.nextZone}><span>Next</span></div>
				<output>{tapDiagnostic}</output>
			</div>
		{/if}
		{#if readerMode === 'paged' && !arePageControlsHidden}
			<button class={`${styles.pageButton} ${styles.previous}`} aria-label="Previous page" onclick={() => rendition?.prev()}>
				<ChevronLeftIcon size={24} decorative={true} />
			</button>
			<button class={`${styles.pageButton} ${styles.next}`} aria-label="Next page" onclick={() => rendition?.next()}>
				<ChevronRightIcon size={24} decorative={true} />
			</button>
		{/if}
	</div>

	<footer class={`${styles.footer} ${readerMode === 'paged' && !arePageControlsHidden ? styles.withControls : ''}`}>
		{#if readerMode === 'paged' && !arePageControlsHidden}
			<button class={styles.mobilePageButton} aria-label="Previous page" onclick={() => rendition?.prev()}>
				<ChevronLeftIcon size={20} decorative={true} />
			</button>
		{/if}
		<div class={styles.progressTrack}><span style={`width: ${percentFinished * 100}%`}></span></div>
		<button
			class={styles.footerStatus}
			aria-label={`Reader status: ${footerStatus}. Tap to show ${nextFooterStatusLabel}.`}
			title={`Tap to show ${nextFooterStatusLabel}`}
			onclick={cycleFooterStatus}
		>
			{footerStatus}
		</button>
		{#if readerMode === 'paged' && !arePageControlsHidden}
			<button class={styles.mobilePageButton} aria-label="Next page" onclick={() => rendition?.next()}>
				<ChevronRightIcon size={20} decorative={true} />
			</button>
		{/if}
	</footer>

	<ReaderSidebar
		isOpen={sidebarOpen}
		activeTab={sidebarTab}
		{toc}
		{annotations}
		canEditHighlights={readerMode === 'paged'}
		{theme}
		{fontSize}
		{isTapNavigationEnabled}
		{arePageControlsHidden}
		{isTapNavigationDebugEnabled}
		{tapNavigationDelayMs}
		onClose={() => (sidebarOpen = false)}
		onSelectTab={(tab) => (sidebarTab = tab)}
		onNavigateToc={(href) => void navigateToc(href)}
		onNavigateAnnotation={(annotation) => void navigateAnnotation(annotation)}
		onDeleteAnnotation={deleteAnnotation}
		onThemeChange={(value) => {
			theme = value;
			applyAppearance();
		}}
		onFontSizeChange={(value) => {
			fontSize = value;
			applyAppearance();
		}}
		onTapNavigationChange={(value) => {
			isTapNavigationEnabled = value;
			updateNavigationPreferences();
		}}
		onPageControlsHiddenChange={(value) => {
			arePageControlsHidden = value;
			updateNavigationPreferences();
		}}
		onTapNavigationDebugChange={(value) => {
			isTapNavigationDebugEnabled = value;
			tapDiagnostic = value ? 'Waiting for a tap' : tapDiagnostic;
			updateNavigationPreferences();
		}}
		onTapNavigationDelayChange={(value) => {
			tapNavigationDelayMs = value;
			updateNavigationPreferences();
		}}
	/>
	{#if sidebarOpen}<button class={styles.backdrop} aria-label="Close reader tools" onclick={() => (sidebarOpen = false)}></button>{/if}

	{#if selectionDraft && readerMode === 'paged'}
		<div class={styles.selectionCard} role="dialog" aria-label="Save highlight">
			<p>{selectionDraft.text}</p>
			<textarea bind:value={noteDraft} rows="2" placeholder="Add a note (optional)"></textarea>
			<label class={styles.colorField}>
				<span>Color</span>
				<select bind:value={highlightColor}>
					<option value="red">Red</option>
					<option value="orange">Orange</option>
					<option value="yellow">Yellow</option>
					<option value="green">Green</option>
					<option value="olive">Olive</option>
					<option value="cyan">Cyan</option>
					<option value="blue">Blue</option>
					<option value="purple">Purple</option>
					<option value="gray">Gray</option>
				</select>
			</label>
			<div>
				<button onclick={() => (selectionDraft = null)}>Cancel</button>
				<button
					class={styles.rsvpAction}
					onclick={() => void startRsvpFromSelection()}
					disabled={isLoading || rsvpIsLoading}
				>
					Start RSVP here
				</button>
				<button class={styles.primary} onclick={saveSelection}>Save highlight</button>
			</div>
		</div>
	{/if}

	{#if saveError}<div class={styles.error} role="alert">{saveError}</div>{/if}
	{#if deepLinkWarning}<div class={styles.warning} role="status">{deepLinkWarning}</div>{/if}
	{#if readerMode === 'paged' && rsvpError}<div class={styles.error} role="alert" aria-live="polite">{rsvpError}</div>{/if}
</div>
