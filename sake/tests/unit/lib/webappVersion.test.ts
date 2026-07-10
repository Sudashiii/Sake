import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createWebappVersion } from '$lib/webappVersion';

describe('createWebappVersion', () => {
	test('falls back to dev-local when the version is blank', () => {
		const version = createWebappVersion({
			version: '   ',
			gitTag: '',
			commitSha: null,
			releasedAt: undefined
		});

		assert.deepEqual(version, {
			version: 'dev-local',
			gitTag: null,
			commitSha: null,
			releasedAt: null
		});
	});

	test('preserves normalized release metadata', () => {
		const version = createWebappVersion({
			version: '2026.03.07.1',
			gitTag: ' webapp/v2026.03.07.1 ',
			commitSha: ' e68f375 ',
			releasedAt: ' 2026-03-07T10:14:00+01:00 '
		});

		assert.deepEqual(version, {
			version: '2026.03.07.1',
			gitTag: 'webapp/v2026.03.07.1',
			commitSha: 'e68f375',
			releasedAt: '2026-03-07T10:14:00+01:00'
		});
	});
});
