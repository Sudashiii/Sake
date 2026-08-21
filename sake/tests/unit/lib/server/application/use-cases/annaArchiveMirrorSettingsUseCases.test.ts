import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AnnaArchiveMirrorSettingsPort } from '$lib/server/application/ports/AnnaArchiveMirrorSettingsPort';
import {
	GetAnnaArchiveMirrorSettingsUseCase,
	UpdateAnnaArchiveMirrorSettingsUseCase
} from '$lib/server/application/use-cases/AnnaArchiveMirrorSettingsUseCases';

describe('Anna Archive mirror settings use cases', () => {
	test('returns the persisted ordered list after a successful update', async () => {
		let stored = ['https://env.example'];
		const settings: AnnaArchiveMirrorSettingsPort = {
			get: async () => stored,
			replace: async (urls) => {
				stored = [...urls];
				return stored;
			}
		};

		const update = await new UpdateAnnaArchiveMirrorSettingsUseCase(settings).execute({
			urls: ['https://primary.example', 'https://backup.example']
		});
		const read = await new GetAnnaArchiveMirrorSettingsUseCase(settings).execute();

		assert.deepEqual(update, {
			ok: true,
			value: { urls: ['https://primary.example', 'https://backup.example'] }
		});
		assert.deepEqual(read, {
			ok: true,
			value: { urls: ['https://primary.example', 'https://backup.example'] }
		});
	});

	test('maps repository read failures to a safe server error', async () => {
		const settings: AnnaArchiveMirrorSettingsPort = {
			get: async () => {
				throw new Error('database details must not escape');
			},
			replace: async (urls) => urls
		};

		const result = await new GetAnnaArchiveMirrorSettingsUseCase(settings).execute();

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.error.status, 500);
		assert.equal(result.error.message, 'Failed to load Anna Archive mirror settings');
		assert.match(String(result.error.cause), /database details/);
	});

	test('returns validation errors for insecure and oversized configurations', async () => {
		let writes = 0;
		const settings: AnnaArchiveMirrorSettingsPort = {
			get: async () => ['https://anna.example'],
			replace: async (urls) => {
				writes += 1;
				return urls;
			}
		};
		const useCase = new UpdateAnnaArchiveMirrorSettingsUseCase(settings);

		const insecure = await useCase.execute({ urls: ['http://anna.example'] });
		const tooMany = await useCase.execute({
			urls: [
				'https://one.example',
				'https://two.example',
				'https://three.example',
				'https://four.example',
				'https://five.example',
				'https://six.example'
			]
		});

		assert.equal(insecure.ok, false);
		assert.equal(tooMany.ok, false);
		if (!insecure.ok) assert.equal(insecure.error.status, 400);
		if (!tooMany.ok) assert.equal(tooMany.error.status, 400);
		assert.equal(writes, 0);
	});

	test('maps repository write failures to a safe server error', async () => {
		const settings: AnnaArchiveMirrorSettingsPort = {
			get: async () => ['https://anna.example'],
			replace: async () => {
				throw new Error('database details must not escape');
			}
		};

		const result = await new UpdateAnnaArchiveMirrorSettingsUseCase(settings).execute({
			urls: ['https://anna.example']
		});

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.error.status, 500);
		assert.equal(result.error.message, 'Failed to save Anna Archive mirror settings');
	});

	test('rejects writes in demo mode before touching persistence', async () => {
		const previousDemoMode = process.env.SAKE_DEMO_MODE;
		process.env.SAKE_DEMO_MODE = 'true';
		let writes = 0;
		try {
			const settings: AnnaArchiveMirrorSettingsPort = {
				get: async () => ['https://anna.example'],
				replace: async (urls) => {
					writes += 1;
					return urls;
				}
			};

			const result = await new UpdateAnnaArchiveMirrorSettingsUseCase(settings).execute({
				urls: ['https://mirror.example']
			});

			assert.equal(result.ok, false);
			if (!result.ok) {
				assert.equal(result.error.status, 403);
				assert.equal(result.error.message, 'Mirror settings cannot be changed in demo mode');
			}
			assert.equal(writes, 0);
		} finally {
			if (previousDemoMode === undefined) {
				delete process.env.SAKE_DEMO_MODE;
			} else {
				process.env.SAKE_DEMO_MODE = previousDemoMode;
			}
		}
	});
});
