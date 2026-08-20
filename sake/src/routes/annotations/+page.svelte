<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ConfirmModal from '$lib/components/ConfirmModal/ConfirmModal.svelte';
	import SectionErrorBanner from '$lib/components/SectionErrorBanner/SectionErrorBanner.svelte';
	import SearchIcon from '$lib/assets/icons/SearchIcon.svelte';
	import RefreshIcon from '$lib/assets/icons/RefreshIcon.svelte';
	import { ZUI } from '$lib/client/zui';
	import { toastStore } from '$lib/client/stores/toastStore.svelte';
	import { HIGHLIGHT_COLORS, type ReaderHighlightColor } from '$lib/koreader/koreaderSidecar';
	import {
		EMPTY_ANNOTATION_QUERY,
		type AnnotationFacetsResponse,
		type AnnotationFilterType,
		type AnnotationHubItem,
		type AnnotationIndexSummary,
		type AnnotationQuery,
		type AnnotationSort
	} from '$lib/types/Annotations/Annotation';
	import type { ApiError } from '$lib/types/ApiError';
	import styles from './page.module.scss';

	let query = $state<AnnotationQuery>({ ...EMPTY_ANNOTATION_QUERY });
	let items = $state<AnnotationHubItem[]>([]);
	let facets = $state<AnnotationFacetsResponse>({ books: [], shelves: [], colors: [], types: [] });
	let index = $state<AnnotationIndexSummary | null>(null);
	let total = $state(0);
	let nextCursor = $state<string | null>(null);
	let isLoading = $state(true);
	let isLoadingMore = $state(false);
	let isReindexing = $state(false);
	let error = $state<ApiError | null>(null);
	let editingId = $state<number | null>(null);
	let noteDraft = $state('');
	let colorDraft = $state<ReaderHighlightColor | null>('yellow');
	let savingId = $state<number | null>(null);
	let pendingDelete = $state<AnnotationHubItem | null>(null);
	let deletingId = $state<number | null>(null);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	let hasFilters = $derived(
		Boolean(query.q || query.bookId || query.shelfId || query.color || query.from || query.to || query.type !== 'all' || query.sort !== 'newest')
	);

	function fromUrl(): AnnotationQuery {
		const params = new URLSearchParams(window.location.search);
		const type = params.get('type');
		const sort = params.get('sort');
		const numberValue = (name: string): number | null => {
			const parsed = Number(params.get(name));
			return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
		};
		return {
			...EMPTY_ANNOTATION_QUERY,
			q: params.get('q')?.trim() || null,
			type: type === 'highlight' || type === 'bookmark' || type === 'with-note' ? type : 'all',
			bookId: numberValue('bookId'),
			shelfId: numberValue('shelfId'),
			color: params.get('color') || null,
			from: params.get('from') || null,
			to: params.get('to') || null,
			sort: sort === 'oldest' || sort === 'book' ? sort : 'newest'
		};
	}

	function urlForQuery(): string {
		const params = new URLSearchParams();
		if (query.q) params.set('q', query.q);
		if (query.type !== 'all') params.set('type', query.type);
		if (query.bookId) params.set('bookId', String(query.bookId));
		if (query.shelfId) params.set('shelfId', String(query.shelfId));
		if (query.color) params.set('color', query.color);
		if (query.from) params.set('from', query.from);
		if (query.to) params.set('to', query.to);
		if (query.sort !== 'newest') params.set('sort', query.sort);
		const encoded = params.toString();
		return encoded ? `/annotations?${encoded}` : '/annotations';
	}

	async function syncUrlAndLoad(): Promise<void> {
		query.cursor = null;
		await goto(urlForQuery(), { replaceState: true, noScroll: true, keepFocus: true });
		await loadAnnotations(true);
	}

	async function loadAnnotations(reset: boolean): Promise<void> {
		if (reset) {
			isLoading = true;
			error = null;
		} else {
			isLoadingMore = true;
		}
		const result = await ZUI.getAnnotations({ ...query, cursor: reset ? null : nextCursor });
		if (!result.ok) {
			error = result.error;
		} else {
			items = reset ? result.value.items : [...items, ...result.value.items];
			total = result.value.total;
			nextCursor = result.value.nextCursor;
			index = result.value.index;
		}
		isLoading = false;
		isLoadingMore = false;
	}

	async function loadFacets(): Promise<void> {
		const result = await ZUI.getAnnotationFacets();
		if (result.ok) facets = result.value;
	}

	function setType(value: string): void {
		query.type = value as AnnotationFilterType;
		void syncUrlAndLoad();
	}

	function setSort(value: string): void {
		query.sort = value as AnnotationSort;
		void syncUrlAndLoad();
	}

	function setNumberFilter(key: 'bookId' | 'shelfId', value: string): void {
		query[key] = value ? Number(value) : null;
		void syncUrlAndLoad();
	}

	function scheduleSearch(value: string): void {
		query.q = value.trim() || null;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => void syncUrlAndLoad(), 300);
	}

	function clearFilters(): void {
		query = { ...EMPTY_ANNOTATION_QUERY };
		void syncUrlAndLoad();
	}

	function beginEdit(item: AnnotationHubItem): void {
		editingId = item.id;
		noteDraft = item.note ?? '';
		colorDraft = HIGHLIGHT_COLORS.includes(item.color as ReaderHighlightColor)
			? (item.color as ReaderHighlightColor)
			: null;
	}

	async function saveEdit(item: AnnotationHubItem): Promise<void> {
		savingId = item.id;
		const result = await ZUI.updateAnnotation(item.id, {
			note: noteDraft.trim() || null,
			...(item.kind === 'highlight' && colorDraft ? { color: colorDraft } : {}),
			expectedVersion: item.version
		});
		savingId = null;
		if (!result.ok) {
			toastStore.add(result.error.message, 'error');
			if (result.error.type === 'server' && result.error.status === 409) await loadAnnotations(true);
			return;
		}
		items = items.map((candidate) => candidate.id === item.id ? result.value : candidate);
		editingId = null;
		toastStore.add('Annotation updated', 'success');
		void loadFacets();
	}

	async function confirmDelete(): Promise<void> {
		if (!pendingDelete) return;
		const target = pendingDelete;
		deletingId = target.id;
		const result = await ZUI.deleteAnnotation(target.id, { expectedVersion: target.version });
		deletingId = null;
		pendingDelete = null;
		if (!result.ok) {
			toastStore.add(result.error.message, 'error');
			await loadAnnotations(true);
			return;
		}
		items = items.filter((candidate) => candidate.id !== target.id);
		total = Math.max(0, total - 1);
		toastStore.add('Annotation deleted', 'success');
		void loadFacets();
	}

	async function retryIndexing(): Promise<void> {
		isReindexing = true;
		const result = await ZUI.reindexAnnotations();
		isReindexing = false;
		if (!result.ok) {
			toastStore.add(result.error.message, 'error');
			return;
		}
		toastStore.add('Annotation indexing started', 'success');
		setTimeout(() => void loadAnnotations(true), 600);
	}

	function bookLink(item: AnnotationHubItem): string {
		return item.book.isArchived
			? `/archived?openBookId=${item.book.id}`
			: `/library?openBookId=${item.book.id}`;
	}

	onMount(() => {
		query = fromUrl();
		void Promise.all([loadAnnotations(true), loadFacets()]);
		const poll = setInterval(() => {
			if (index && (index.isReconciling || index.pendingBooks > 0)) void loadAnnotations(true);
		}, 4000);
		return () => {
			clearInterval(poll);
			if (searchTimer) clearTimeout(searchTimer);
		};
	});
</script>

<div class={styles.root}>
	<section class={styles.intro}>
		<div>
			<p class={styles.eyebrow}>Reading memory</p>
			<h1>Highlights and annotations</h1>
			<p>Search every passage, note, and bookmark saved by KOReader or the web reader.</p>
		</div>
		<div class={styles.exportActions} aria-label="Export annotations">
			<a href={ZUI.annotationExportUrl(query, 'markdown')}>Export Markdown</a>
			<a href={ZUI.annotationExportUrl(query, 'json')}>Export JSON</a>
		</div>
	</section>

	{#if index && (index.isReconciling || index.pendingBooks > 0 || index.failedBooks > 0)}
		<section class={styles.indexStatus} aria-live="polite">
			<div>
				<strong>{index.isReconciling ? 'Indexing reading notes' : 'Annotation index needs attention'}</strong>
				<span>{index.indexedBooks} of {index.totalBooks} books indexed{index.failedBooks ? `, ${index.failedBooks} failed` : ''}.</span>
			</div>
			<button type="button" onclick={() => void retryIndexing()} disabled={isReindexing || index.isReconciling}>
				<RefreshIcon size={16} decorative={true} /> {isReindexing ? 'Starting…' : 'Retry'}
			</button>
		</section>
	{/if}

	<section class={styles.filters} aria-label="Annotation filters">
		<label class={styles.searchField}>
			<SearchIcon size={18} decorative={true} />
			<span class="sr-only">Search annotations</span>
			<input value={query.q ?? ''} oninput={(event) => scheduleSearch(event.currentTarget.value)} placeholder="Search passages, notes, books, or authors" />
		</label>
		<select aria-label="Annotation type" value={query.type} onchange={(event) => setType(event.currentTarget.value)}>
			<option value="all">All annotations</option>
			<option value="highlight">Highlights</option>
			<option value="bookmark">Bookmarks</option>
			<option value="with-note">With notes</option>
		</select>
		<select aria-label="Book" value={query.bookId ?? ''} onchange={(event) => setNumberFilter('bookId', event.currentTarget.value)}>
			<option value="">All books</option>
			{#each facets.books as option (option.id)}<option value={option.id}>{option.label} ({option.count})</option>{/each}
		</select>
		<select aria-label="Shelf" value={query.shelfId ?? ''} onchange={(event) => setNumberFilter('shelfId', event.currentTarget.value)}>
			<option value="">All shelves</option>
			{#each facets.shelves as option (option.id)}<option value={option.id}>{option.label} ({option.count})</option>{/each}
		</select>
		<select aria-label="Highlight color" value={query.color ?? ''} onchange={(event) => { query.color = event.currentTarget.value || null; void syncUrlAndLoad(); }}>
			<option value="">All colors</option>
			{#each facets.colors as option (option.id)}<option value={option.id}>{option.label} ({option.count})</option>{/each}
		</select>
		<label class={styles.dateField}><span>From</span><input type="date" value={query.from ?? ''} onchange={(event) => { query.from = event.currentTarget.value || null; void syncUrlAndLoad(); }} /></label>
		<label class={styles.dateField}><span>To</span><input type="date" value={query.to ?? ''} onchange={(event) => { query.to = event.currentTarget.value || null; void syncUrlAndLoad(); }} /></label>
		<select aria-label="Sort annotations" value={query.sort} onchange={(event) => setSort(event.currentTarget.value)}>
			<option value="newest">Newest first</option>
			<option value="oldest">Oldest first</option>
			<option value="book">By book</option>
		</select>
		{#if hasFilters}<button type="button" class={styles.clearButton} onclick={clearFilters}>Clear filters</button>{/if}
	</section>

	{#if error}
		<SectionErrorBanner message={error.message} onRetry={() => void loadAnnotations(true)} />
	{:else if isLoading}
		<div class={styles.loading} aria-live="polite">Loading annotations…</div>
	{:else if items.length === 0}
		<section class={styles.empty}>
			<h2>{hasFilters ? 'No matching annotations' : 'Your reading notes will collect here'}</h2>
			<p>{hasFilters ? 'Try broadening the search or clearing the active filters.' : 'Create a highlight, note, or bookmark in KOReader or Sake’s EPUB reader, then sync reading progress.'}</p>
			{#if hasFilters}<button type="button" onclick={clearFilters}>Clear filters</button>{/if}
		</section>
	{:else}
		<div class={styles.resultMeta}>{total} annotation{total === 1 ? '' : 's'}</div>
		<section class={styles.timeline} aria-label="Annotations">
			{#each items as item (item.id)}
				<article class={styles.annotation}>
					<div class={styles.bookContext}>
						{#if item.book.cover}<img src={item.book.cover} alt="" loading="lazy" />{:else}<div class={styles.coverFallback} aria-hidden="true">{item.book.title.slice(0, 1)}</div>{/if}
						<div><a href={bookLink(item)}>{item.book.title}</a><span>{item.book.author || 'Unknown author'}</span>{#if item.book.isArchived}<small>Archived</small>{/if}</div>
					</div>
					<div class={styles.annotationBody}>
						<header>
							<div><span class={styles.kind}>{item.kind}</span>{#if item.color}<span class={styles.colorLabel}><i style={`--annotation-color: ${item.color}`}></i>{item.color}</span>{/if}</div>
							<time>{item.updatedAt ?? item.recordedAt}</time>
						</header>
						{#if item.chapter}<p class={styles.chapter}>{item.chapter}</p>{/if}
						{#if item.text}<blockquote>{item.text}</blockquote>{/if}
						{#if editingId === item.id}
							<div class={styles.editor}>
								<label><span>Note</span><textarea rows="4" maxlength="20000" bind:value={noteDraft}></textarea></label>
								{#if item.kind === 'highlight'}<label><span>Color</span><select value={colorDraft ?? ''} onchange={(event) => (colorDraft = event.currentTarget.value ? event.currentTarget.value as ReaderHighlightColor : null)}>{#if colorDraft === null}<option value="">Keep {item.color || 'original color'}</option>{/if}{#each HIGHLIGHT_COLORS as color}<option value={color}>{color}</option>{/each}</select></label>{/if}
								<div><button type="button" onclick={() => (editingId = null)} disabled={savingId === item.id}>Cancel</button><button type="button" class={styles.primaryButton} onclick={() => void saveEdit(item)} disabled={savingId === item.id}>{savingId === item.id ? 'Saving…' : 'Save'}</button></div>
							</div>
						{:else if item.note}<p class={styles.note}>{item.note}</p>{/if}
						<footer>
							{#if item.book.extension?.toLowerCase() === 'epub'}<a class={styles.openButton} href={`/library/${item.book.id}/read?annotationId=${item.id}`}>Open in reader</a>{:else}<a class={styles.openButton} href={bookLink(item)}>View book</a>{/if}
							<button type="button" onclick={() => beginEdit(item)}>Edit</button>
							<button type="button" class={styles.deleteButton} onclick={() => (pendingDelete = item)}>Delete</button>
						</footer>
					</div>
				</article>
			{/each}
		</section>
		{#if nextCursor}<div class={styles.loadMore}><button type="button" onclick={() => void loadAnnotations(false)} disabled={isLoadingMore}>{isLoadingMore ? 'Loading…' : 'Load more'}</button></div>{/if}
	{/if}
</div>

<ConfirmModal open={pendingDelete !== null} title="Delete annotation?" message="This removes the annotation from the KOReader sidecar and syncs the change to your devices." confirmLabel="Delete annotation" danger={true} pending={deletingId !== null} onConfirm={confirmDelete} onCancel={() => (pendingDelete = null)} />
