import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	LOGS_TABS,
	formatDeviceLogSource,
	formatLogContextValue,
	formatLogDetails,
	formatLogLevel,
	formatLogTimestamp,
	getContextPreview,
	hasLogDetails,
	isLogsSourceAvailable
} from '$lib/features/logs/logsView';
import type { WebappLogEntry } from '$lib/types/Logs/WebappLogEntry';

const sampleEntry: WebappLogEntry = {
	id: '1',
	timestamp: '2026-03-29T10:15:20.000Z',
	level: 'info',
	message: 'Request completed',
	context: {
		route: '/library',
		statusCode: 200,
		requestId: 'abc-123'
	}
};

describe('logsView', () => {
	test('defines webapp and device tabs as available sources', () => {
		assert.deepEqual(
			LOGS_TABS.map((tab) => ({ key: tab.key, available: tab.available })),
			[
				{ key: 'webapp', available: true },
				{ key: 'devices', available: true }
			]
		);
		assert.equal(isLogsSourceAvailable('webapp'), true);
		assert.equal(isLogsSourceAvailable('devices'), true);
	});

	test('formats log level and timestamp fallbacks safely', () => {
		assert.equal(formatLogLevel('warn'), 'WARN');
		assert.equal(formatLogLevel('unknown'), 'UNKNOWN');
		assert.equal(formatLogTimestamp('not-a-date'), 'not-a-date');
		assert.ok(formatLogTimestamp(sampleEntry.timestamp).length > 0);
	});

	test('formats preview and details content', () => {
		assert.equal(formatLogContextValue({ ok: true }), '{"ok":true}');
		assert.deepEqual(getContextPreview(sampleEntry, 2), [
			{ key: 'route', value: '/library' },
			{ key: 'statusCode', value: '200' }
		]);
		assert.equal(hasLogDetails(sampleEntry), true);
		assert.equal(
			formatLogDetails(sampleEntry),
			JSON.stringify({ context: sampleEntry.context }, null, 2)
		);
	});

	test('formats device log source labels safely', () => {
		assert.equal(formatDeviceLogSource('sake'), 'Sake');
		assert.equal(formatDeviceLogSource(''), 'Unknown source');
	});
});
