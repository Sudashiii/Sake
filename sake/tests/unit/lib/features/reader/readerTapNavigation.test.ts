import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	ReaderTapNavigation,
	type PageDirection,
	type ReaderTapDiagnostic
} from '$lib/features/reader/readerTapNavigation';

const waitForNavigation = () => new Promise((resolve) => setTimeout(resolve, 10));

function gesture(
	navigation: ReaderTapNavigation,
	options: {
		detail?: number;
		duration?: number;
		hasSelection?: boolean;
		isInteractive?: boolean;
		moveToX?: number;
		source?: 'mouse' | 'touch';
		x: number;
	}
): void {
	const source = options.source ?? 'mouse';
	navigation.start({ x: options.x, y: 20, time: 100 }, source);
	if (options.moveToX !== undefined) {
		navigation.move({ x: options.moveToX, y: 20, time: 120 }, source);
	}
	const endedAt = 100 + (options.duration ?? 40);
	navigation.end({ x: options.moveToX ?? options.x, y: 20, time: endedAt }, source);
	navigation.click({
		x: options.x,
		time: endedAt + 1,
		detail: options.detail ?? 1,
		viewportWidth: 900,
		hasSelection: options.hasSelection ?? false,
		isInteractive: options.isInteractive ?? false
	});
}

describe('reader tap navigation', () => {
	test('navigates from the left and right thirds but leaves the center inert', async () => {
		const directions: PageDirection[] = [];
		const navigation = new ReaderTapNavigation((direction) => directions.push(direction), {
			navigationDelayMs: 1
		});

		gesture(navigation, { x: 100 });
		await waitForNavigation();
		gesture(navigation, { x: 800 });
		await waitForNavigation();
		gesture(navigation, { x: 450 });
		await waitForNavigation();

		assert.deepEqual(directions, ['previous', 'next']);
	});

	test('cancels the first click when a double-click begins', async () => {
		const directions: PageDirection[] = [];
		const navigation = new ReaderTapNavigation((direction) => directions.push(direction), {
			navigationDelayMs: 5
		});

		gesture(navigation, { x: 100 });
		navigation.start({ x: 100, y: 20, time: 180 }, 'mouse');
		navigation.end({ x: 100, y: 20, time: 210 }, 'mouse');
		navigation.click({
			x: 100,
			time: 211,
			detail: 2,
			viewportWidth: 900,
			hasSelection: true,
			isInteractive: false
		});
		await waitForNavigation();

		assert.deepEqual(directions, []);
	});

	test('rejects long presses, movement, selections, and interactive content', async () => {
		const directions: PageDirection[] = [];
		const navigation = new ReaderTapNavigation((direction) => directions.push(direction), {
			navigationDelayMs: 1
		});

		gesture(navigation, { x: 100, duration: 500 });
		gesture(navigation, { x: 100, moveToX: 130 });
		gesture(navigation, { x: 100, hasSelection: true });
		gesture(navigation, { x: 100, isInteractive: true });
		await waitForNavigation();

		assert.deepEqual(directions, []);
	});

	test('keeps a moved touch gesture rejected through synthesized mouse events', async () => {
		const directions: PageDirection[] = [];
		const navigation = new ReaderTapNavigation((direction) => directions.push(direction), {
			navigationDelayMs: 1
		});

		navigation.start({ x: 100, y: 20, time: 100 }, 'touch');
		navigation.move({ x: 140, y: 20, time: 120 }, 'touch');
		navigation.end({ x: 140, y: 20, time: 140 }, 'touch');
		navigation.start({ x: 100, y: 20, time: 150 }, 'mouse');
		navigation.end({ x: 100, y: 20, time: 160 }, 'mouse');
		navigation.click({
			x: 100,
			time: 161,
			detail: 1,
			viewportWidth: 900,
			hasSelection: false,
			isInteractive: false
		});
		await waitForNavigation();

		assert.deepEqual(directions, []);
	});

	test('disabling the feature cancels delayed navigation', async () => {
		const directions: PageDirection[] = [];
		const navigation = new ReaderTapNavigation((direction) => directions.push(direction), {
			navigationDelayMs: 5
		});

		gesture(navigation, { x: 800 });
		navigation.setEnabled(false);
		await waitForNavigation();

		assert.deepEqual(directions, []);
	});

	test('emits scheduled and navigation diagnostics only in debug mode', async () => {
		const diagnostics: ReaderTapDiagnostic[] = [];
		const navigation = new ReaderTapNavigation(() => undefined, {
			navigationDelayMs: 1,
			onDiagnostic: (diagnostic) => diagnostics.push(diagnostic)
		});

		gesture(navigation, { x: 800 });
		await waitForNavigation();
		assert.equal(diagnostics.length, 0);

		navigation.setDebugEnabled(true);
		gesture(navigation, { x: 800 });
		await waitForNavigation();

		assert.ok(
			diagnostics.some(
				(diagnostic) =>
					diagnostic.type === 'tap-scheduled' && diagnostic.direction === 'next'
			)
		);
		assert.ok(
			diagnostics.some(
				(diagnostic) =>
					diagnostic.type === 'navigate' && diagnostic.direction === 'next'
			)
		);
	});

	test('supports changing the delay to instant at runtime', () => {
		const directions: PageDirection[] = [];
		const navigation = new ReaderTapNavigation((direction) => directions.push(direction), {
			navigationDelayMs: 500
		});

		navigation.setNavigationDelay(0);
		gesture(navigation, { x: 800 });

		assert.deepEqual(directions, ['next']);
	});
});
