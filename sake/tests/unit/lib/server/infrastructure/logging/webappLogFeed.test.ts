import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { InMemoryWebappLogFeed } from '$lib/server/infrastructure/logging/webappLogFeed';

function writeJsonLine(feed: InMemoryWebappLogFeed, payload: Record<string, unknown>): void {
	feed.write(`${JSON.stringify(payload)}\n`);
}

describe('webapp log feed', () => {
	test('buffers the newest entries up to the configured limit', () => {
		const feed = new InMemoryWebappLogFeed(3);

		writeJsonLine(feed, { level: 30, time: 1, msg: 'first' });
		writeJsonLine(feed, { level: 30, time: 2, msg: 'second' });
		writeJsonLine(feed, { level: 30, time: 3, msg: 'third' });
		writeJsonLine(feed, { level: 30, time: 4, msg: 'fourth' });

		const observation = feed.observe();
		assert.deepEqual(
			observation.snapshot.map((entry) => entry.message),
			['second', 'third', 'fourth']
		);
	});

	test('parses json lines only after a newline and extracts context and errors', () => {
		const feed = new InMemoryWebappLogFeed(5);

		feed.write('{"level":50,"time":"2026-03-29T10:15:20.000Z","msg":"failed","route":"/queue","service":"sake","env":"development","name":"sake"');
		assert.equal(feed.observe().snapshot.length, 0);

		feed.write(',"err":{"type":"Error","message":"Boom","stack":"trace"}}\n');

		const [entry] = feed.observe().snapshot;
		assert.equal(entry?.message, 'failed');
		assert.equal(entry?.level, 'error');
		assert.deepEqual(entry?.context, { route: '/queue' });
		assert.deepEqual(entry?.error, {
			name: 'Error',
			message: 'Boom',
			stack: 'trace'
		});
	});

	test('replays snapshots and stops notifying after unsubscribe', () => {
		const feed = new InMemoryWebappLogFeed(5);

		writeJsonLine(feed, { level: 30, time: 1, msg: 'snapshot entry' });

		const observation = feed.observe();
		const seen: string[] = [];
		const unsubscribe = observation.subscribe((entry) => {
			seen.push(entry.message);
		});

		assert.equal(observation.snapshot[0]?.message, 'snapshot entry');

		writeJsonLine(feed, { level: 30, time: 2, msg: 'live entry' });
		unsubscribe();
		writeJsonLine(feed, { level: 30, time: 3, msg: 'ignored entry' });

		assert.deepEqual(seen, ['live entry']);
	});
});
