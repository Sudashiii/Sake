import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { RsvpPlaybackController, type RsvpTimer } from '$lib/features/reader/rsvpPlayback';
import type { RsvpToken } from '$lib/features/reader/rsvpText';

function token(text: string, multiplier = 1): RsvpToken {
	return {
		text,
		coreText: text,
		sectionIndex: 0,
		paragraphIndex: 0,
		sentenceIndex: 0,
		startXPointer: `/body/DocFragment/body/p/text().0`,
		endXPointer: `/body/DocFragment/body/p/text().${text.length}`,
		startCfi: `epubcfi(/6/2!/4/2:0)`,
		percentFinished: 0,
		delayMultiplier: multiplier,
		isSentenceEnd: false,
		isParagraphEnd: false,
		isSectionEnd: false,
		startPoint: { node: {} as never, offset: 0 },
		endPoint: { node: {} as never, offset: 1 }
	};
}

class FakeTimer implements RsvpTimer {
	callback: (() => void) | null = null;
	delay = 0;

	setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
		this.callback = callback;
		this.delay = delay;
		return 1 as unknown as ReturnType<typeof setTimeout>;
	}

	clearTimeout(): void {
		this.callback = null;
	}

	fire(): void {
		const callback = this.callback;
		this.callback = null;
		callback?.();
	}
}

describe('RSVP playback', () => {
	test('starts paused, advances only after the current token delay, and completes at EOF', async () => {
		const timer = new FakeTimer();
		const tokens = [token('one'), token('two', 2)];
		let index = 0;
		const seen: string[] = [];
		let completed = false;
		const controller = new RsvpPlaybackController(
			{
				async moveWords(delta) {
					const next = index + delta;
					if (next < 0 || next >= tokens.length) return null;
					index = next;
					return tokens[index];
				},
				async moveSentence() {
					return tokens[index];
				}
			},
			{
				onToken: (value) => seen.push(value.text),
				onCompleted: () => (completed = true)
			},
			timer
		);

		controller.setToken(tokens[0]);
		assert.equal(controller.isPlaying, false);
		controller.play();
		assert.equal(timer.delay, 200);
		timer.fire();
		await Promise.resolve();
		assert.deepEqual(seen, ['one', 'two']);
		assert.equal(timer.delay, 400);
		timer.fire();
		await Promise.resolve();
		assert.equal(completed, true);
		assert.equal(controller.isPlaying, false);
	});

	test('pausing cancels a pending timer and speed changes reschedule playback', () => {
		const timer = new FakeTimer();
		const controller = new RsvpPlaybackController(
			{ moveWords: async () => null, moveSentence: async () => null },
			{ onToken: () => undefined },
			timer
		);
		controller.setToken(token('word'));
		controller.play();
		assert.equal(timer.delay, 200);
		controller.setWpm(600);
		assert.equal(timer.delay, 100);
		controller.pause();
		assert.equal(timer.callback, null);
	});

	test('keeps the displayed token aligned when an async advance resolves after pause', async () => {
		const timer = new FakeTimer();
		const first = token('one');
		const second = token('two');
		const third = token('three');
		let releaseFirstMove: (() => void) | undefined;
		let moveCalls = 0;
		const controller = new RsvpPlaybackController(
			{
				async moveWords() {
					moveCalls += 1;
					if (moveCalls === 1) {
						await new Promise<void>((resolve) => {
							releaseFirstMove = resolve;
						});
						return second;
					}
					return third;
				},
				async moveSentence() {
					return null;
				}
			},
			{ onToken: () => undefined },
			timer
		);

		controller.setToken(first);
		controller.play();
		timer.fire();
		await Promise.resolve();
		controller.pause();
		releaseFirstMove?.();
		await Promise.resolve();
		await Promise.resolve();
		assert.equal(controller.token?.text, 'two');

		controller.play();
		timer.fire();
		await Promise.resolve();
		await Promise.resolve();
		assert.equal(controller.token?.text, 'three');
	});
});
