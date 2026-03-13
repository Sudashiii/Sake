import type {
	PluginRelease,
	UpsertPluginReleaseInput
} from '$lib/server/domain/entities/PluginRelease';

export interface PluginReleaseRepositoryPort {
	upsert(input: UpsertPluginReleaseInput): Promise<PluginRelease>;
	setLatestVersion(version: string): Promise<void>;
	getLatest(): Promise<PluginRelease | undefined>;
}
