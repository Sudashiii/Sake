import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	applyReaderAppearance,
	parseReaderTheme,
	registerReaderAppearance,
	type ReaderTheme
} from '../../src/lib/features/reader/readerAppearance';

function createThemeController() {
	const registered: object[] = [];
	const overrides = new Map<string, string>();
	let fontSize = '';

	return {
		controller: {
			themes: {
				default(theme: object) {
					registered.push(theme);
				},
				override(name: string, value: string) {
					overrides.set(name, value);
				},
				fontSize(value: string) {
					fontSize = value;
				}
			}
		},
		registered,
		overrides,
		getFontSize: () => fontSize
	};
}

describe('reader appearance', () => {
	test('uses one stable stylesheet and replaces variables on every theme change', () => {
		const state = createThemeController();
		registerReaderAppearance(state.controller);

		const backgrounds: string[] = [];
		for (const theme of ['paper', 'night', 'sepia', 'paper', 'night'] satisfies ReaderTheme[]) {
			applyReaderAppearance(state.controller, theme, 110);
			backgrounds.push(state.overrides.get('--sake-reader-background') ?? '');
		}

		assert.equal(state.registered.length, 1);
		assert.deepEqual(new Set(backgrounds), new Set(['#fbfaf7', '#111318', '#ead8b5']));
		assert.equal(backgrounds.at(-2), '#fbfaf7');
		assert.equal(backgrounds.at(-1), '#111318');
		assert.equal(state.getFontSize(), '110%');
	});

	test('paper and sepia use visibly different palettes', () => {
		const state = createThemeController();
		applyReaderAppearance(state.controller, 'paper', 100);
		const paper = Object.fromEntries(state.overrides);
		applyReaderAppearance(state.controller, 'sepia', 100);
		const sepia = Object.fromEntries(state.overrides);

		assert.notEqual(sepia['--sake-reader-background'], paper['--sake-reader-background']);
		assert.notEqual(sepia['--sake-reader-text'], paper['--sake-reader-text']);
		assert.notEqual(sepia['--sake-reader-link'], paper['--sake-reader-link']);
	});

	test('falls back to paper for stale stored values', () => {
		assert.equal(parseReaderTheme('sepia'), 'sepia');
		assert.equal(parseReaderTheme('unknown'), 'paper');
		assert.equal(parseReaderTheme(null), 'paper');
	});
});
