import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	getDefaultSearchFilterPreferences,
	getActiveProviderOptions,
	getDefaultSelectedProviders,
	loadStoredSearchFilterPreferences,
	normalizeProviderSelection,
	persistSearchFilterPreferences
} from '$lib/features/search/searchView';

class MemoryStorage implements Storage {
	#values = new Map<string, string>();

	get length(): number {
		return this.#values.size;
	}

	clear(): void {
		this.#values.clear();
	}

	getItem(key: string): string | null {
		return this.#values.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.#values.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.#values.delete(key);
	}

	setItem(key: string, value: string): void {
		this.#values.set(key, value);
	}
}

describe('searchView provider activation helpers', () => {
	test('defaults to zlibrary when active', () => {
		assert.deepEqual(getDefaultSelectedProviders(['zlibrary', 'gutenberg']), ['zlibrary']);
	});

	test('falls back to first active provider when zlibrary is disabled', () => {
		assert.deepEqual(getDefaultSelectedProviders(['gutenberg', 'openlibrary']), ['gutenberg']);
	});

	test('clamps provider selections to active providers', () => {
		assert.deepEqual(
			normalizeProviderSelection(['zlibrary', 'openlibrary'], ['gutenberg', 'openlibrary']),
			['openlibrary']
		);
		assert.deepEqual(normalizeProviderSelection(['zlibrary'], ['gutenberg']), ['gutenberg']);
	});

	test('filters provider options to active providers only', () => {
		assert.deepEqual(
			getActiveProviderOptions(['gutenberg', 'openlibrary']).map((option) => option.value),
			['openlibrary', 'gutenberg']
		);
	});
});

describe('searchView filter preference storage', () => {
	test('persists and restores valid filter preferences', () => {
		const storage = new MemoryStorage();
		const preferences = {
			selectedLanguages: ['english', 'french'],
			selectedFormats: ['epub', 'pdf'],
			selectedSort: 'year_desc' as const,
			onlyFilesAvailable: true
		};

		persistSearchFilterPreferences(storage, preferences);

		assert.deepEqual(loadStoredSearchFilterPreferences(storage), preferences);
	});

	test('falls back safely when stored filter preferences are invalid', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			'sake.search.filters',
			JSON.stringify({
				selectedLanguages: ['english', 'klingon'],
				selectedFormats: ['cbz'],
				selectedSort: 'random',
				onlyFilesAvailable: 'yes'
			})
		);

			assert.deepEqual(loadStoredSearchFilterPreferences(storage), {
				...getDefaultSearchFilterPreferences(),
				selectedLanguages: ['english'],
				selectedFormats: [],
				onlyFilesAvailable: false
			});
		});
	});
