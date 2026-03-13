<script lang="ts">
	import MultiSelectDropdown from '$lib/components/MultiSelectDropdown/MultiSelectDropdown.svelte';
	import type { SearchSortValue } from '$lib/features/search/searchView';
	import styles from './SearchFiltersPanel.module.scss';

	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		providerOptions: readonly Option[];
		languageOptions: readonly Option[];
		formatOptions: readonly Option[];
		sortOptions: readonly { value: SearchSortValue; label: string }[];
		selectedProviders: string[];
		selectedLanguages?: string[];
		selectedFormats?: string[];
		selectedSort?: SearchSortValue;
		yearFromInput?: string | number;
		yearToInput?: string | number;
		onlyFilesAvailable?: boolean;
		onProviderSelection: (values: string[]) => void;
		onLanguageSelection: (values: string[]) => void;
		onFormatSelection: (values: string[]) => void;
	}

	let {
		providerOptions,
		languageOptions,
		formatOptions,
		sortOptions,
		selectedProviders,
		selectedLanguages = $bindable([]),
		selectedFormats = $bindable([]),
		selectedSort = $bindable('relevance'),
		yearFromInput = $bindable(''),
		yearToInput = $bindable(''),
		onlyFilesAvailable = $bindable(false),
		onProviderSelection,
		onLanguageSelection,
		onFormatSelection
	}: Props = $props();
</script>

<div class={styles.root}>
	<div class="filter-group providers">
		<span id="search-providers-label" class="filter-label">Providers</span>
		<MultiSelectDropdown
			id="search-providers"
			labelId="search-providers-label"
			selected={selectedProviders}
			options={[...providerOptions]}
			placeholder="Select providers"
			onchange={onProviderSelection}
		/>
	</div>
	<div class="filter-group">
		<span id="search-language-label" class="filter-label">Languages</span>
		<MultiSelectDropdown
			id="search-language"
			labelId="search-language-label"
			bind:selected={selectedLanguages}
			options={[...languageOptions]}
			placeholder="All languages"
			onchange={onLanguageSelection}
		/>
	</div>
	<div class="filter-group">
		<span id="search-format-label" class="filter-label">Formats</span>
		<MultiSelectDropdown
			id="search-format"
			labelId="search-format-label"
			bind:selected={selectedFormats}
			options={[...formatOptions]}
			placeholder="All formats"
			onchange={onFormatSelection}
		/>
	</div>
	<div class="filter-group years">
		<label for="search-year-from">Year</label>
		<div class="year-range-inputs">
			<input id="search-year-from" type="number" min="0" step="1" placeholder="from" bind:value={yearFromInput} />
			<input id="search-year-to" type="number" min="0" step="1" placeholder="to" bind:value={yearToInput} />
		</div>
	</div>
	<div class="filter-group">
		<label for="search-sort">Sort</label>
		<select id="search-sort" bind:value={selectedSort} class="single-filter-select">
			{#each sortOptions as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
	<div class="filter-group filter-toggle-group">
		<label class="toggle-label" for="search-only-files">
			<input id="search-only-files" type="checkbox" bind:checked={onlyFilesAvailable} />
			<span>Only files available</span>
		</label>
	</div>
</div>
