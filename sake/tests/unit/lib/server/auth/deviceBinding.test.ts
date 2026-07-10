import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveAuthorizedDeviceId } from '$lib/server/auth/deviceBinding';

describe('deviceBinding', () => {
	test('rejects API key requests that try to supply a different deviceId', () => {
		const locals = {
			auth: {
				type: 'api_key',
				user: { id: 1 },
				apiKeyId: 1,
				deviceId: 'device-a',
				scope: 'device'
			}
		} as App.Locals;

		assert.deepEqual(resolveAuthorizedDeviceId(locals, 'device-b', { required: true }), {
			ok: false,
			status: 403,
			message: 'API key is not allowed for this device'
		});
	});
});
