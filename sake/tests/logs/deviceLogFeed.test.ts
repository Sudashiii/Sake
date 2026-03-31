import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { InMemoryDeviceLogFeed } from '$lib/server/infrastructure/logging/deviceLogFeed';

describe('device log feed', () => {
	test('buffers the newest entries per device up to the configured limit', () => {
		const feed = new InMemoryDeviceLogFeed(2);

		feed.append({
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:00:00.000Z',
			level: 'info',
			message: 'first',
			source: 'sake'
		});
		feed.append({
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:01:00.000Z',
			level: 'warn',
			message: 'second',
			source: 'sake'
		});
		feed.append({
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:02:00.000Z',
			level: 'error',
			message: 'third',
			source: 'sake'
		});
		feed.append({
			deviceId: 'device-b',
			timestamp: '2026-03-29T10:03:00.000Z',
			level: 'info',
			message: 'other device',
			source: 'sake'
		});

		assert.deepEqual(
			feed.observe('device-a').snapshot.map((entry) => entry.message),
			['second', 'third']
		);
		assert.deepEqual(
			feed.observe('device-b').snapshot.map((entry) => entry.message),
			['other device']
		);
	});

	test('replays snapshots and stops notifying after unsubscribe', () => {
		const feed = new InMemoryDeviceLogFeed(5);
		feed.append({
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:00:00.000Z',
			level: 'info',
			message: 'snapshot entry',
			source: 'sake'
		});

		const observation = feed.observe('device-a');
		const seen: string[] = [];
		const unsubscribe = observation.subscribe((entry) => {
			seen.push(entry.message);
		});

		assert.equal(observation.snapshot[0]?.message, 'snapshot entry');

		feed.append({
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:01:00.000Z',
			level: 'warn',
			message: 'live entry',
			source: 'sake'
		});
		unsubscribe();
		feed.append({
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:02:00.000Z',
			level: 'error',
			message: 'ignored entry',
			source: 'sake'
		});

		assert.deepEqual(seen, ['live entry']);
	});

	test('evicts the least recently used device backlogs when the tracked device limit is exceeded', () => {
		const feed = new InMemoryDeviceLogFeed(5, 2);

		feed.append({
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:00:00.000Z',
			level: 'info',
			message: 'first device',
			source: 'sake'
		});
		feed.append({
			deviceId: 'device-b',
			timestamp: '2026-03-29T10:01:00.000Z',
			level: 'info',
			message: 'second device',
			source: 'sake'
		});
		feed.append({
			deviceId: 'device-c',
			timestamp: '2026-03-29T10:02:00.000Z',
			level: 'info',
			message: 'third device',
			source: 'sake'
		});

		assert.deepEqual(
			feed.observe('device-b').snapshot.map((entry) => entry.message),
			['second device']
		);
		assert.deepEqual(
			feed.observe('device-c').snapshot.map((entry) => entry.message),
			['third device']
		);
		assert.deepEqual(feed.observe('device-a').snapshot, []);
	});

	test('keeps active subscribers attached when an older backlog is evicted', () => {
		const feed = new InMemoryDeviceLogFeed(5, 1);
		const seen: string[] = [];
		const unsubscribe = feed.observe('device-a').subscribe((entry) => {
			seen.push(entry.message);
		});

		feed.append({
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:00:00.000Z',
			level: 'info',
			message: 'first device',
			source: 'sake'
		});
		feed.append({
			deviceId: 'device-b',
			timestamp: '2026-03-29T10:01:00.000Z',
			level: 'info',
			message: 'second device',
			source: 'sake'
		});

		assert.deepEqual(feed.observe('device-a').snapshot, []);

		feed.append({
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:02:00.000Z',
			level: 'warn',
			message: 'device returns',
			source: 'sake'
		});

		assert.deepEqual(seen, ['first device', 'device returns']);
		assert.deepEqual(
			feed.observe('device-a').snapshot.map((entry) => entry.message),
			['device returns']
		);

		unsubscribe();
	});
});
