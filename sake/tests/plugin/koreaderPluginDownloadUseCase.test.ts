import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { PluginReleaseRepositoryPort } from '$lib/server/application/ports/PluginReleaseRepositoryPort';
import type { StorageObjectInfo, StoragePort } from '$lib/server/application/ports/StoragePort';
import type { PluginRelease, UpsertPluginReleaseInput } from '$lib/server/domain/entities/PluginRelease';
import { GetKoreaderPluginDownloadUseCase } from '$lib/server/application/use-cases/GetKoreaderPluginDownloadUseCase';

function createRelease(overrides: Partial<PluginRelease> = {}): PluginRelease {
	return {
		id: 1,
		version: '0.9.0',
		fileName: 'sake-koplugin-v0.9.0.zip',
		storageKey: 'plugins/koreader/sake-koplugin-v0.9.0.zip',
		sha256: 'abc123',
		isLatest: true,
		createdAt: '2026-04-02T10:00:00.000Z',
		updatedAt: '2026-04-02T10:00:00.000Z',
		...overrides
	};
}

class StubPluginReleaseRepository implements PluginReleaseRepositoryPort {
	constructor(
		private readonly latest: PluginRelease | undefined,
		private readonly byVersion: Map<string, PluginRelease> = new Map()
	) {}

	async upsert(_input: UpsertPluginReleaseInput): Promise<PluginRelease> {
		throw new Error('not implemented in test');
	}

	async setLatestVersion(_version: string): Promise<void> {
		throw new Error('not implemented in test');
	}

	async getLatest(): Promise<PluginRelease | undefined> {
		return this.latest;
	}

	async getByVersion(version: string): Promise<PluginRelease | undefined> {
		return this.byVersion.get(version);
	}

	async listAll(): Promise<PluginRelease[]> {
		return [...this.byVersion.values()];
	}
}

class StubStorage implements StoragePort {
	public lastGetKey: string | null = null;

	constructor(private readonly objects: Map<string, Buffer>) {}

	async put(
		_key: string,
		_body: Buffer | Uint8Array | NodeJS.ReadableStream,
		_contentType?: string
	): Promise<void> {
		throw new Error('not implemented in test');
	}

	async get(key: string): Promise<Buffer> {
		this.lastGetKey = key;
		const value = this.objects.get(key);
		if (!value) {
			throw new Error(`missing object: ${key}`);
		}
		return value;
	}

	async delete(_key: string): Promise<void> {
		throw new Error('not implemented in test');
	}

	async list(_prefix: string): Promise<StorageObjectInfo[]> {
		return [];
	}
}

describe('GetKoreaderPluginDownloadUseCase', () => {
	test('keeps the old updater path working by downloading the latest release when no version is requested', async () => {
		const latest = createRelease();
		const storage = new StubStorage(new Map([[latest.storageKey, Buffer.from('latest-zip')]]));
		const useCase = new GetKoreaderPluginDownloadUseCase(
			storage,
			new StubPluginReleaseRepository(latest, new Map([[latest.version, latest]]))
		);

		const result = await useCase.execute();

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}

		assert.equal(storage.lastGetKey, latest.storageKey);
		assert.equal(result.value.fileName, latest.fileName);
		assert.equal(result.value.sha256, latest.sha256);
		assert.equal(result.value.data.toString(), 'latest-zip');
	});

	test('downloads an explicitly requested older release for the new version picker flow', async () => {
		const latest = createRelease();
		const older = createRelease({
			id: 2,
			version: '0.8.5',
			fileName: 'sake-koplugin-v0.8.5.zip',
			storageKey: 'plugins/koreader/sake-koplugin-v0.8.5.zip',
			sha256: 'def456',
			isLatest: false
		});
		const storage = new StubStorage(
			new Map([
				[latest.storageKey, Buffer.from('latest-zip')],
				[older.storageKey, Buffer.from('older-zip')]
			])
		);
		const useCase = new GetKoreaderPluginDownloadUseCase(
			storage,
			new StubPluginReleaseRepository(latest, new Map([
				[latest.version, latest],
				[older.version, older]
			]))
		);

		const result = await useCase.execute('0.8.5');

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}

		assert.equal(storage.lastGetKey, older.storageKey);
		assert.equal(result.value.fileName, older.fileName);
		assert.equal(result.value.sha256, older.sha256);
		assert.equal(result.value.data.toString(), 'older-zip');
	});

	test('returns a 404 when a requested version does not exist', async () => {
		const latest = createRelease();
		const storage = new StubStorage(new Map([[latest.storageKey, Buffer.from('latest-zip')]]));
		const useCase = new GetKoreaderPluginDownloadUseCase(
			storage,
			new StubPluginReleaseRepository(latest, new Map([[latest.version, latest]]))
		);

		const result = await useCase.execute('0.1.0');

		assert.equal(result.ok, false);
		if (result.ok) {
			throw new Error('Expected not found result');
		}

		assert.equal(result.error.status, 404);
		assert.equal(result.error.message, 'Plugin version not found');
		assert.equal(storage.lastGetKey, null);
	});
});
