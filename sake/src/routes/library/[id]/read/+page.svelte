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
	} from '$lib/features/reader/koreaderSidecar';
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
	import {
		ReaderTapNavigation,
		type ReaderTapDiagnostic
	} from '$lib/features/reader/readerTapNavigation';
	import { bindRenditionTapNavigation } from '$lib/features/reader/readerTapNavigationBinding';
	import styles from './page.module.scss';

	const { data } = $props();

	let viewportShell = $state<HTMLDivElement | null>(null);
	let viewport = $state<HTMLDivElement | null>(null);
	let book: Book | null = null;
	let rendition: Rendition | null = null;
	let spineCount = 1;
	let toc = $state<NavItem[]>([]);
	let annotations = $state<ReaderAnnotation[]>([]);
	let currentXPointer = $state<string | null>(null);
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
	let selectionDraft = $state<SelectionDraft | null>(null);
	let noteDraft = $state('');
	let highlightColor = $state('yellow');
	let unbindTapNavigation: (() => void) | null = null;
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
		currentXPointer = cfiToKoreaderXPointer(rendition, location.start.cfi, spineCount);
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
		renderVisibleAnnotations();
		saveQueue.schedule();
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
		saveQueue.delete(annotation.id);
		annotations = annotations.filter((item) => item.id !== annotation.id);
		saveQueue.schedule(0);
	}

	async function navigateAnnotation(annotation: ReaderAnnotation): Promise<void> {
		sidebarOpen = false;
		await restoreXPointer(annotation.pos0 ?? annotation.page);
	}

	onMount(() => {
		let isDestroyed = false;
		let clockTimer: ReturnType<typeof setTimeout> | null = null;

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
				const [contentResponse, sidecar, epubModule] = await Promise.all([
					fetch(`/api/library/${data.book.bookId}/content`),
					fetchKoreaderSidecar(data.book.fileName),
					import('epubjs')
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
				if (sidecar?.lastXPointer) {
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
			if (clockTimer) clearTimeout(clockTimer);
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
			<button aria-label="Open reader tools" onclick={() => (sidebarOpen = true)}><MenuIcon size={20} decorative={true} /></button>
			<a href="/library" aria-label="Back to library"><ChevronLeftIcon size={20} decorative={true} /></a>
		</div>
		<div class={styles.title}>
			<strong>{data.book.title}</strong>
			<span>{data.book.author || 'Unknown author'}</span>
		</div>
		<div class={styles.toolbarGroup}>
			<span class={styles.saveStatus}>{saveError ? 'Not saved' : isSaving ? 'Saving…' : 'Saved'}</span>
			<button aria-label="Add bookmark" onclick={addBookmark}><BookmarkPlusIcon size={20} decorative={true} /></button>
		</div>
	</header>

	<div bind:this={viewportShell} class={styles.viewportShell}>
		{#if isLoading}
			<div class={styles.loading}><BookOpenIcon size={30} decorative={true} /><span>Opening book…</span></div>
		{/if}
		<div bind:this={viewport} class={styles.viewport}></div>
		{#if isTapNavigationDebugEnabled}
			<div class={styles.tapZones} aria-hidden="true">
				<div class={styles.previousZone}><span>Previous</span></div>
				<div class={styles.centerZone}><span>No navigation</span></div>
				<div class={styles.nextZone}><span>Next</span></div>
				<output>{tapDiagnostic}</output>
			</div>
		{/if}
		{#if !arePageControlsHidden}
			<button class={`${styles.pageButton} ${styles.previous}`} aria-label="Previous page" onclick={() => rendition?.prev()}>
				<ChevronLeftIcon size={24} decorative={true} />
			</button>
			<button class={`${styles.pageButton} ${styles.next}`} aria-label="Next page" onclick={() => rendition?.next()}>
				<ChevronRightIcon size={24} decorative={true} />
			</button>
		{/if}
	</div>

	<footer class={`${styles.footer} ${!arePageControlsHidden ? styles.withControls : ''}`}>
		{#if !arePageControlsHidden}
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
		{#if !arePageControlsHidden}
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
		{theme}
		{fontSize}
		{isTapNavigationEnabled}
		{arePageControlsHidden}
		{isTapNavigationDebugEnabled}
		{tapNavigationDelayMs}
		onClose={() => (sidebarOpen = false)}
		onSelectTab={(tab) => (sidebarTab = tab)}
		onNavigateToc={(href) => {
			sidebarOpen = false;
			void rendition?.display(href);
		}}
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

	{#if selectionDraft}
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
				<button class={styles.primary} onclick={saveSelection}>Save highlight</button>
			</div>
		</div>
	{/if}

	{#if saveError}<div class={styles.error} role="alert">{saveError}</div>{/if}
</div>
