import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { PluginReleaseRepositoryPort } from '$lib/server/application/ports/PluginReleaseRepositoryPort';
import type { PluginRelease, UpsertPluginReleaseInput } from '$lib/server/domain/entities/PluginRelease';
import {
	compareKoreaderPluginVersions,
	getKoreaderPluginUpstreamStatus,
	parseKoreaderPluginMetaVersion
} from '$lib/server/application/services/koreaderPluginVersion';
import { GetKoreaderPluginUpstreamVersionUseCase } from '$lib/server/application/use-cases/GetKoreaderPluginUpstreamVersionUseCase';

function createRelease(version: string): PluginRelease {
	return {
		id: 1,
		version,
		fileName: `sake-koplugin-v${version}.zip`,
		storageKey: `plugins/koreader/sake-koplugin-v${version}.zip`,
		sha256: 'abc123',
		isLatest: true,
		createdAt: '2026-04-02T10:00:00.000Z',
		updatedAt: '2026-04-02T10:00:00.000Z'
	};
}

class StubPluginReleaseRepository implements PluginReleaseRepositoryPort {
	constructor(private readonly latest: PluginRelease | undefined) {}

	async upsert(_input: UpsertPluginReleaseInput): Promise<PluginRelease> {
		throw new Error('not implemented in test');
	}

	async setLatestVersion(_version: string): Promise<void> {
		throw new Error('not implemented in test');
	}

	async getLatest(): Promise<PluginRelease | undefined> {
		return this.latest;
	}

	async getByVersion(_version: string): Promise<PluginRelease | undefined> {
		throw new Error('not implemented in test');
	}

	async listAll(): Promise<PluginRelease[]> {
		return this.latest ? [this.latest] : [];
	}
}

describe('KOReader plugin version helpers', () => {
	test('parses version from KOReader _meta.lua content', () => {
		const version = parseKoreaderPluginMetaVersion(`
			return {
				name = "sake",
				version = "1.0.4",
			}
		`);

		assert.equal(version, '1.0.4');
	});

	test('returns null when _meta.lua content does not include a version', () => {
		assert.equal(parseKoreaderPluginMetaVersion('return { name = "sake" }'), null);
	});

	test('compares numeric version segments', () => {
		assert.equal(compareKoreaderPluginVersions('1.0.10', '1.0.9') > 0, true);
		assert.equal(compareKoreaderPluginVersions('1.0.0', '1.0.1') < 0, true);
		assert.equal(compareKoreaderPluginVersions('1.0.0', '1.0') === 0, true);
	});

	test('maps uploaded and upstream versions to status labels', () => {
		assert.equal(getKoreaderPluginUpstreamStatus('1.0.4', '1.0.4'), 'up_to_date');
		assert.equal(getKoreaderPluginUpstreamStatus('1.0.3', '1.0.4'), 'outdated');
		assert.equal(getKoreaderPluginUpstreamStatus('1.0.5', '1.0.4'), 'uploaded_newer');
	});
});

describe('GetKoreaderPluginUpstreamVersionUseCase', () => {
	test('reports up_to_date when uploaded and upstream versions match', async () => {
		const useCase = new GetKoreaderPluginUpstreamVersionUseCase(
			new StubPluginReleaseRepository(createRelease('1.0.4')),
			async () => new Response('return { version = "1.0.4" }')
		);

		const result = await useCase.execute();

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}
		assert.equal(result.value.status, 'up_to_date');
		assert.equal(result.value.uploadedVersion, '1.0.4');
		assert.equal(result.value.upstreamVersion, '1.0.4');
	});

	test('reports outdated when GitHub has a newer version', async () => {
		const useCase = new GetKoreaderPluginUpstreamVersionUseCase(
			new StubPluginReleaseRepository(createRelease('1.0.3')),
			async () => new Response('return { version = "1.0.4" }')
		);

		const result = await useCase.execute();

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}
		assert.equal(result.value.status, 'outdated');
	});

	test('reports uploaded_newer when the uploaded artifact is ahead of GitHub', async () => {
		const useCase = new GetKoreaderPluginUpstreamVersionUseCase(
			new StubPluginReleaseRepository(createRelease('1.0.5')),
			async () => new Response('return { version = "1.0.4" }')
		);

		const result = await useCase.execute();

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}
		assert.equal(result.value.status, 'uploaded_newer');
	});

	test('reports unavailable when upstream metadata cannot be fetched', async () => {
		const useCase = new GetKoreaderPluginUpstreamVersionUseCase(
			new StubPluginReleaseRepository(createRelease('1.0.4')),
			async () => {
				throw new Error('network unavailable');
			}
		);

		const result = await useCase.execute();

		assert.equal(result.ok, true);
		if (!result.ok) {
			throw new Error('Expected success');
		}
		assert.equal(result.value.status, 'unavailable');
		assert.equal(result.value.uploadedVersion, '1.0.4');
		assert.equal(result.value.upstreamVersion, null);
	});
});
