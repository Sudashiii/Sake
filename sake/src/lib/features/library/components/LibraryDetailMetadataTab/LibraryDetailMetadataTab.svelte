<script lang="ts">
	import UploadIcon from '$lib/assets/icons/UploadIcon.svelte';
	import type { LibraryBook } from '$lib/types/Library/Book';
	import type { LibraryBookDetail } from '$lib/types/Library/BookDetail';
	import {
		formatLibraryPublicationDate,
		isImportableExternalCoverUrl,
		toGoogleBooksUrl,
		toOpenLibraryUrl,
		type MetadataDraft
	} from '$lib/features/library/libraryView';
	import styles from './LibraryDetailMetadataTab.module.scss';

	interface Props {
		selectedBook: LibraryBook;
		selectedBookDetail: LibraryBookDetail;
		metadataDraft: MetadataDraft;
		isEditingMetadata?: boolean;
		isImportingCover?: boolean;
		onImportCover: () => void;
		onUploadCoverFile: (event: Event) => void;
	}

	let {
		selectedBook,
		selectedBookDetail,
		metadataDraft = $bindable(),
		isEditingMetadata = false,
		isImportingCover = false,
		onImportCover,
		onUploadCoverFile
	}: Props = $props();

	const activeCoverUrl = $derived(metadataDraft.cover.trim() || selectedBook.cover || '');
	const canImportCover = $derived(isImportableExternalCoverUrl(activeCoverUrl));

	let uploadInput = $state<HTMLInputElement | null>(null);

	function openUploadPicker(): void {
		uploadInput?.click();
	}
</script>

<div class={styles.root}>
	<div class="detail-v2-metadata-cover">
		<p class="detail-v2-caption">Cover</p>
		<div>
			{#if activeCoverUrl}
				<img src={activeCoverUrl} alt={selectedBookDetail.title} />
			{:else}
				<div class="no-cover"><span class="extension">?</span></div>
			{/if}
			<div class="detail-v2-cover-meta">
				{#if isEditingMetadata}
					<div class="detail-v2-cover-edit-row">
						<input
							class="detail-v2-input"
							bind:value={metadataDraft.cover}
							placeholder="https://books.google.com/..."
						/>
						<input
							bind:this={uploadInput}
							class="detail-v2-cover-upload-input"
							type="file"
							accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
							onchange={onUploadCoverFile}
							disabled={isImportingCover}
						/>
						<button
							type="button"
							class="detail-v2-cover-upload-btn"
							onclick={openUploadPicker}
							disabled={isImportingCover}
						>
							<UploadIcon size={14} decorative={true} />
							<span>{isImportingCover ? 'Uploading...' : 'Upload your own'}</span>
						</button>
					</div>
				{:else}
					<span>{activeCoverUrl || 'No cover URL'}</span>
				{/if}

				{#if canImportCover}
					<button
						type="button"
						class="detail-v2-cover-import-btn"
						onclick={onImportCover}
						disabled={isImportingCover}
					>
						{isImportingCover ? 'Importing...' : 'Store Internally'}
					</button>
				{/if}
			</div>
		</div>
	</div>

	<div class="detail-v2-metadata-description">
		<p class="detail-v2-caption">Description</p>
		{#if isEditingMetadata}
			<textarea rows="4" class="detail-v2-textarea" bind:value={metadataDraft.description}></textarea>
		{:else}
			<p>{selectedBookDetail.description || 'No description available.'}</p>
		{/if}
	</div>

	<div class="detail-v2-metadata-grid">
		<div><p class="detail-v2-caption">Title</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.title} />{:else}<p>{selectedBookDetail.title}</p>{/if}</div>
		<div><p class="detail-v2-caption">Author</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.author} />{:else}<p>{selectedBookDetail.author || '—'}</p>{/if}</div>
		<div><p class="detail-v2-caption">Publisher</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.publisher} />{:else}<p>{selectedBookDetail.publisher || '—'}</p>{/if}</div>
		<div><p class="detail-v2-caption">Series</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.series} />{:else}<p>{selectedBookDetail.series || '—'}</p>{/if}</div>
		<div><p class="detail-v2-caption">Series Index</p>{#if isEditingMetadata}<input class="detail-v2-input" type="number" step="0.1" bind:value={metadataDraft.seriesIndex} />{:else}<p>{selectedBookDetail.seriesIndex ?? '—'}</p>{/if}</div>
		<div><p class="detail-v2-caption">Volume</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.volume} />{:else}<p>{selectedBookDetail.volume || '—'}</p>{/if}</div>
		<div><p class="detail-v2-caption">Edition</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.edition} />{:else}<p>{selectedBookDetail.edition || '—'}</p>{/if}</div>
		<div><p class="detail-v2-caption">Identifier</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.identifier} />{:else}<p>{selectedBookDetail.identifier || '—'}</p>{/if}</div>
		<div class="detail-v2-date-field">
			<p class="detail-v2-caption">Published Date</p>
			{#if isEditingMetadata}
				<div class="detail-v2-date-inputs">
					<input class="detail-v2-input detail-v2-date-input detail-v2-date-input-year" bind:value={metadataDraft.year} placeholder="YYYY" inputmode="numeric" />
					<span class="detail-v2-date-separator">/</span>
					<input class="detail-v2-input detail-v2-date-input" bind:value={metadataDraft.month} placeholder="MM" inputmode="numeric" />
					<span class="detail-v2-date-separator">/</span>
					<input class="detail-v2-input detail-v2-date-input" bind:value={metadataDraft.day} placeholder="DD" inputmode="numeric" />
				</div>
			{:else}
				<p>{formatLibraryPublicationDate(selectedBookDetail)}</p>
			{/if}
		</div>
		<div><p class="detail-v2-caption">Pages</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.pages} />{:else}<p>{selectedBookDetail.pages || '—'}</p>{/if}</div>
		<div><p class="detail-v2-caption">Language</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.language} />{:else}<p>{selectedBook.language || '—'}</p>{/if}</div>
		<div>
			<p class="detail-v2-caption">Google Books ID</p>
			{#if isEditingMetadata}
				<input class="detail-v2-input" bind:value={metadataDraft.googleBooksId} />
			{:else if selectedBookDetail.googleBooksId}
				<p>
					<a class="detail-v2-meta-link" href={toGoogleBooksUrl(selectedBookDetail.googleBooksId)} target="_blank" rel="noopener noreferrer">
						{selectedBookDetail.googleBooksId}
					</a>
				</p>
			{:else}
				<p>—</p>
			{/if}
		</div>
		<div>
			<p class="detail-v2-caption">Open Library Key</p>
			{#if isEditingMetadata}
				<input class="detail-v2-input" bind:value={metadataDraft.openLibraryKey} />
			{:else if selectedBookDetail.openLibraryKey}
				<p>
					<a class="detail-v2-meta-link" href={toOpenLibraryUrl(selectedBookDetail.openLibraryKey)} target="_blank" rel="noopener noreferrer">
						{selectedBookDetail.openLibraryKey}
					</a>
				</p>
			{:else}
				<p>—</p>
			{/if}
		</div>
		<div><p class="detail-v2-caption">Amazon ASIN</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.amazonAsin} />{:else}<p>{selectedBookDetail.amazonAsin || '—'}</p>{/if}</div>
		<div><p class="detail-v2-caption">External Rating</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.externalRating} />{:else}<p>{selectedBookDetail.externalRating !== null ? `${selectedBookDetail.externalRating}/5` : '—'}</p>{/if}</div>
		<div><p class="detail-v2-caption">Rating Count</p>{#if isEditingMetadata}<input class="detail-v2-input" bind:value={metadataDraft.externalRatingCount} />{:else}<p>{selectedBookDetail.externalRatingCount ? selectedBookDetail.externalRatingCount.toLocaleString() : '—'}</p>{/if}</div>
	</div>
</div>
