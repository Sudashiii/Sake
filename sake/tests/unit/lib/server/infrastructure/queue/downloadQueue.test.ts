import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ExternalClientError } from '$lib/server/infrastructure/clients/externalClientPolicy';
import { isRetryableExternalFailure } from '$lib/server/infrastructure/queue/downloadQueue';

describe('download queue retry classification', () => {
	test('uses structured external causes instead of their messages', () => {
		assert.equal(
			isRetryableExternalFailure(
				502,
				new ExternalClientError('arbitrary message', 502, false, 'invalid_response')
			),
			false
		);
		assert.equal(
			isRetryableExternalFailure(
				400,
				new ExternalClientError('arbitrary message', 504, true, 'timeout')
			),
			true
		);
	});

	test('retains status-based retries for unstructured upstream failures', () => {
		assert.equal(isRetryableExternalFailure(429, undefined), true);
		assert.equal(isRetryableExternalFailure(503, undefined), true);
		assert.equal(isRetryableExternalFailure(400, new Error('timeout')), false);
	});
});
