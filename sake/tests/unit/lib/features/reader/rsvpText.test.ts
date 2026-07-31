import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	getRsvpDelayMultiplier,
	getRsvpDelayMs,
	segmentRsvpText,
	splitRsvpWord
} from '$lib/features/reader/rsvpText';

describe('RSVP text handling', () => {
	test('keeps opening and closing punctuation with the natural word', () => {
		const segments = segmentRsvpText('“Hello,” world!');
		assert.deepEqual(
			segments.map((segment) => [segment.text, segment.coreText]),
			[
				['“Hello,”', 'Hello'],
				['world!', 'world']
			]
		);
	});

	test('segments Unicode words and keeps grapheme clusters intact for the focal letter', () => {
		const segments = segmentRsvpText('快速阅读 😀 ❤️ now');
		assert.deepEqual(segments.map((segment) => segment.coreText), ['快速', '阅读', '😀', '❤️', 'now']);
		assert.deepEqual(
			splitRsvpWord({ text: '😀', coreText: '😀' }),
			{ prefix: '', focus: '😀', suffix: '' }
		);
		assert.deepEqual(
			splitRsvpWord({ text: '❤️', coreText: '❤️' }),
			{ prefix: '', focus: '❤️', suffix: '' }
		);
	});

	test('uses focal-letter buckets and punctuation timing multipliers', () => {
		assert.deepEqual(
			splitRsvpWord({ text: 'reading', coreText: 'reading' }),
			{ prefix: 're', focus: 'a', suffix: 'ding' }
		);
		assert.equal(getRsvpDelayMultiplier('word'), 1);
		assert.equal(getRsvpDelayMultiplier('word,'), 1.5);
		assert.equal(getRsvpDelayMultiplier('word.'), 2);
		assert.equal(getRsvpDelayMultiplier('word', true), 2.25);
		assert.equal(getRsvpDelayMultiplier('word', true, true), 3);
		assert.equal(getRsvpDelayMs(300, { delayMultiplier: 1.5 }), 300);
	});
});
