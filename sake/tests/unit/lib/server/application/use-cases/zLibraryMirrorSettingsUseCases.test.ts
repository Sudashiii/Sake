import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ZLibraryMirrorSettingsPort } from '$lib/server/application/ports/ZLibraryMirrorSettingsPort';
import {
	GetZLibraryMirrorSettingsUseCase,
	UpdateZLibraryMirrorSettingsUseCase
} from '$lib/server/application/use-cases/ZLibraryMirrorSettingsUseCases';

describe('ZLibrary mirror settings use cases', () => {
	test('maps repository read failures to a safe server error', async () => {
		const settings: ZLibraryMirrorSettingsPort = {
			get: async () => {
				throw new Error('database details must not escape');
			},
			replace: async (urls) => urls
		};

		const result = await new GetZLibraryMirrorSettingsUseCase(settings).execute();

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.error.status, 500);
		assert.equal(result.error.message, 'Failed to load Z-Library mirror settings');
		assert.match(String(result.error.cause), /database details/);
	});

	test('returns validation errors for insecure and oversized configurations', async () => {
		let writes = 0;
		const settings: ZLibraryMirrorSettingsPort = {
			get: async () => ['https://z.example'],
			replace: async (urls) => {
				writes += 1;
				return urls;
			}
		};
		const useCase = new UpdateZLibraryMirrorSettingsUseCase(settings);

		const insecure = await useCase.execute({ urls: ['http://z.example'] });
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
		const settings: ZLibraryMirrorSettingsPort = {
			get: async () => ['https://z.example'],
			replace: async () => {
				throw new Error('database details must not escape');
			}
		};

		const result = await new UpdateZLibraryMirrorSettingsUseCase(settings).execute({
			urls: ['https://z.example']
		});

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.error.status, 500);
		assert.equal(result.error.message, 'Failed to save Z-Library mirror settings');
	});
});
