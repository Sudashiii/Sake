import { eq } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { hardcoverProgressSettings } from '$lib/server/infrastructure/db/schema';

const SETTINGS_ID = 1;

export interface HardcoverProgressSettings {
	enabled: boolean;
	lastSuccessfulSyncAt: string | null;
}

export class HardcoverProgressSettingsRepository {
	async get(): Promise<HardcoverProgressSettings | null> {
		const [row] = await drizzleDb
			.select()
			.from(hardcoverProgressSettings)
			.where(eq(hardcoverProgressSettings.id, SETTINGS_ID))
			.limit(1);
		return row
			? { enabled: row.enabled, lastSuccessfulSyncAt: row.lastSuccessfulSyncAt }
			: null;
	}

	async setEnabled(enabled: boolean): Promise<HardcoverProgressSettings> {
		const now = new Date().toISOString();
		await drizzleDb
			.insert(hardcoverProgressSettings)
			.values({ id: SETTINGS_ID, enabled, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: hardcoverProgressSettings.id,
				set: { enabled, updatedAt: now }
			});
		return (await this.get()) ?? { enabled, lastSuccessfulSyncAt: null };
	}

	async markSuccessful(at: string): Promise<void> {
		await drizzleDb
			.insert(hardcoverProgressSettings)
			.values({
				id: SETTINGS_ID,
				enabled: true,
				lastSuccessfulSyncAt: at,
				createdAt: at,
				updatedAt: at
			})
			.onConflictDoUpdate({
				target: hardcoverProgressSettings.id,
				set: { lastSuccessfulSyncAt: at, updatedAt: at }
			});
	}
}
