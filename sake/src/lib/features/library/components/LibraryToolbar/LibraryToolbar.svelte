<script lang="ts">
	import ChevronDownIcon from '$lib/assets/icons/ChevronDownIcon.svelte';
	import FilterIcon from '$lib/assets/icons/FilterIcon.svelte';
	import GridIcon from '$lib/assets/icons/GridIcon.svelte';
	import ListIcon from '$lib/assets/icons/ListIcon.svelte';
	import SearchIcon from '$lib/assets/icons/SearchIcon.svelte';
	import SortIcon from '$lib/assets/icons/SortIcon.svelte';
	import LibraryUploadControl from '../LibraryUploadControl/LibraryUploadControl.svelte';
	import {
		getFilterLabel,
		getSortDirectionLabel,
		getSortFieldLabel,
		LIBRARY_SORT_DIRECTION_OPTIONS,
		LIBRARY_SORT_FIELD_OPTIONS,
		type LibrarySortDirection,
		type LibrarySortField,
		type LibrarySortPreference,
		type LibraryStatusFilter,
		type LibraryView,
		type LibraryVisualMode
	} from '$lib/features/library/libraryView';
	import styles from './LibraryToolbar.module.scss';

	interface Props {
		currentView: LibraryView;
		searchQuery?: string;
		statusFilter: LibraryStatusFilter;
		sortPreference: LibrarySortPreference;
		visualMode?: LibraryVisualMode;
		showFilters?: boolean;
		showSortFieldMenu?: boolean;
		isUploadingLibraryFile?: boolean;
		onSetSortField: (value: LibrarySortField) => void;
		onSetSortDirection: (value: LibrarySortDirection) => void;
		onSelectFilterOption: (option: 'all' | 'unread' | 'reading' | 'read' | 'archivedView' | 'trashView') => void;
		onUploadChange: (event: Event) => void;
	}

	let {
		currentView,
		searchQuery = $bindable(''),
		statusFilter,
		sortPreference,
		visualMode = $bindable('grid'),
		showFilters = $bindable(false),
		showSortFieldMenu = $bindable(false),
		isUploadingLibraryFile = false,
		onSetSortField,
		onSetSortDirection,
		onSelectFilterOption,
		onUploadChange
	}: Props = $props();
</script>

<section class={styles.root}>
	<label class="search-wrap" for="library-search">
		<SearchIcon size={18} decorative={true} />
		<input
			id="library-search"
			type="text"
			bind:value={searchQuery}
			placeholder={
				currentView === 'library'
					? 'Search your library...'
					: currentView === 'archived'
						? 'Search archived books...'
						: 'Search trash...'
			}
		/>
	</label>

	<div class="toolbar-actions">
		{#if currentView === 'library'}
			<LibraryUploadControl isUploading={isUploadingLibraryFile} onChange={onUploadChange} />
		{/if}

		{#if currentView !== 'trash'}
			<div class="menu-wrap">
				<button type="button" class="control-btn" onclick={() => { showSortFieldMenu = !showSortFieldMenu; showFilters = false; }}>
					<SortIcon size={17} decorative={true} />
					<span>{getSortFieldLabel(sortPreference.field)}</span>
					<ChevronDownIcon size={14} decorative={true} />
				</button>
				{#if showSortFieldMenu}
					<button type="button" class="menu-backdrop" aria-label="Close sort field menu" onclick={() => (showSortFieldMenu = false)}></button>
					<div class="menu-popover">
						{#each LIBRARY_SORT_FIELD_OPTIONS as option (option.value)}
							<button type="button" class:active={sortPreference.field === option.value} onclick={() => { onSetSortField(option.value); showSortFieldMenu = false; }}>
								{option.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="direction-toggle" role="group" aria-label="Sort direction">
				{#each LIBRARY_SORT_DIRECTION_OPTIONS as option (option.value)}
					<button
						type="button"
						class:active={sortPreference.direction === option.value}
						aria-pressed={sortPreference.direction === option.value}
						aria-label={`Sort ${getSortDirectionLabel(option.value)}`}
						onclick={() => onSetSortDirection(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		{/if}

		<div class="menu-wrap">
			<button type="button" class="control-btn" onclick={() => { showFilters = !showFilters; showSortFieldMenu = false; }}>
				<FilterIcon size={17} decorative={true} />
				<span>{getFilterLabel(currentView, statusFilter)}</span>
				<ChevronDownIcon size={14} decorative={true} />
			</button>
			{#if showFilters}
				<button type="button" class="menu-backdrop" aria-label="Close filter menu" onclick={() => (showFilters = false)}></button>
				<div class="menu-popover filter-popover">
					<button type="button" class:active={currentView === 'library' && statusFilter === 'all'} onclick={() => onSelectFilterOption('all')}>All</button>
					<button type="button" class:active={currentView === 'library' && statusFilter === 'unread'} onclick={() => onSelectFilterOption('unread')}>Unread</button>
					<button type="button" class:active={currentView === 'library' && statusFilter === 'reading'} onclick={() => onSelectFilterOption('reading')}>Reading</button>
					<button type="button" class:active={currentView === 'library' && statusFilter === 'read'} onclick={() => onSelectFilterOption('read')}>Read</button>
					<div class="menu-separator"></div>
					<button type="button" class:active={currentView === 'archived'} onclick={() => onSelectFilterOption('archivedView')}>Archived</button>
					<button type="button" class:active={currentView === 'trash'} onclick={() => onSelectFilterOption('trashView')}>Trash</button>
				</div>
			{/if}
		</div>

		{#if currentView !== 'trash'}
			<div class="mode-toggle" role="group" aria-label="Display mode">
				<button type="button" aria-label="Grid view" class:active={visualMode === 'grid'} aria-pressed={visualMode === 'grid'} onclick={() => (visualMode = 'grid')}>
					<GridIcon size={17} decorative={true} />
				</button>
				<button type="button" aria-label="List view" class:active={visualMode === 'list'} aria-pressed={visualMode === 'list'} onclick={() => (visualMode = 'list')}>
					<ListIcon size={17} decorative={true} />
				</button>
			</div>
		{/if}
	</div>
</section>
