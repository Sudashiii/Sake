import type { PluginReleaseRepositoryPort } from '$lib/server/application/ports/PluginReleaseRepositoryPort';
import type {
	PluginRelease,
	UpsertPluginReleaseInput
} from '$lib/server/domain/entities/PluginRelease';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { pluginReleases } from '$lib/server/infrastructure/db/schema';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import { desc, eq } from 'drizzle-orm';

function mapRow(row: typeof pluginReleases.$inferSelect): PluginRelease {
	return {
		id: row.id,
		version: row.version,
		fileName: row.fileName,
		storageKey: row.storageKey,
		sha256: row.sha256,
		isLatest: Boolean(row.isLatest),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export class PluginReleaseRepository implements PluginReleaseRepositoryPort {
	private readonly repoLogger = createChildLogger({ repository: 'PluginReleaseRepository' });

	async upsert(input: UpsertPluginReleaseInput): Promise<PluginRelease> {
		const now = new Date().toISOString();
		const [row] = await drizzleDb
			.insert(pluginReleases)
			.values({
				version: input.version,
				fileName: input.fileName,
				storageKey: input.storageKey,
				sha256: input.sha256,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: pluginReleases.version,
				set: {
					fileName: input.fileName,
					storageKey: input.storageKey,
					sha256: input.sha256,
					updatedAt: now
				}
			})
			.returning();

		if (!row) {
			throw new Error('Failed to upsert plugin release');
		}

		this.repoLogger.info(
			{ event: 'plugin_release.upserted', version: input.version, storageKey: input.storageKey },
			'Plugin release metadata upserted'
		);

		return mapRow(row);
	}

	async setLatestVersion(version: string): Promise<void> {
		await drizzleDb.transaction(async (tx) => {
			await tx.update(pluginReleases).set({ isLatest: false });
			await tx
				.update(pluginReleases)
				.set({ isLatest: true, updatedAt: new Date().toISOString() })
				.where(eq(pluginReleases.version, version));
		});

		this.repoLogger.info(
			{ event: 'plugin_release.latest_set', version },
			'Set plugin release latest version'
		);
	}

	async getLatest(): Promise<PluginRelease | undefined> {
		const [explicitLatest] = await drizzleDb
			.select()
			.from(pluginReleases)
			.where(eq(pluginReleases.isLatest, true))
			.orderBy(desc(pluginReleases.updatedAt))
			.limit(1);

		if (explicitLatest) {
			return mapRow(explicitLatest);
		}

		const [fallbackLatest] = await drizzleDb
			.select()
			.from(pluginReleases)
			.orderBy(desc(pluginReleases.updatedAt), desc(pluginReleases.createdAt))
			.limit(1);

		return fallbackLatest ? mapRow(fallbackLatest) : undefined;
	}
}
