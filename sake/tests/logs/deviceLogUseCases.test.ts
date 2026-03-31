import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AppendDeviceLogUseCase } from '$lib/server/application/use-cases/AppendDeviceLogUseCase';
import { ObserveDeviceLogsUseCase } from '$lib/server/application/use-cases/ObserveDeviceLogsUseCase';
import { InMemoryDeviceLogFeed } from '$lib/server/infrastructure/logging/deviceLogFeed';
import type { DeviceRepositoryPort } from '$lib/server/application/ports/DeviceRepositoryPort';

function createDeviceRepository(): DeviceRepositoryPort {
	return {
		async getByUserIdAndDeviceId(userId: number, deviceId: string) {
			if (userId === 1 && deviceId === 'device-a') {
				return {
					id: 1,
					userId,
					deviceId,
					pluginVersion: '0.6.0',
					createdAt: '2026-03-29T09:00:00.000Z',
					updatedAt: '2026-03-29T09:00:00.000Z',
					lastSeenAt: '2026-03-29T09:00:00.000Z'
				};
			}
			return undefined;
		}
	} as DeviceRepositoryPort;
}

describe('device log use cases', () => {
	test('appends a device log for an owned device', async () => {
		const feed = new InMemoryDeviceLogFeed(5);
		const useCase = new AppendDeviceLogUseCase(createDeviceRepository(), feed);

		const result = await useCase.execute({
			userId: 1,
			deviceId: 'device-a',
			timestamp: '2026-03-29T10:15:20.000Z',
			level: 'info',
			message: 'hello from the device',
			source: 'sake'
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}

		assert.equal(result.value.deviceId, 'device-a');
		assert.equal(result.value.message, 'hello from the device');
		assert.equal(feed.observe('device-a').snapshot.length, 1);
	});

	test('rejects invalid device log payloads', async () => {
		const feed = new InMemoryDeviceLogFeed(5);
		const useCase = new AppendDeviceLogUseCase(createDeviceRepository(), feed);

		const result = await useCase.execute({
			userId: 1,
			deviceId: 'device-a',
			timestamp: 'not-a-timestamp',
			level: 'info',
			message: 'hello from the device',
			source: 'sake'
		});

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected failure');
		}
		assert.equal(result.error.status, 400);
	});

	test('rejects observing logs for a device the user does not own', async () => {
		const feed = new InMemoryDeviceLogFeed(5);
		const useCase = new ObserveDeviceLogsUseCase(createDeviceRepository(), feed);

		const result = await useCase.execute({
			userId: 2,
			deviceId: 'device-a'
		});

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected failure');
		}
		assert.equal(result.error.status, 404);
	});
});
