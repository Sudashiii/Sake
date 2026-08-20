import { eq } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { zlibraryMirrorSettings } from '$lib/server/infrastructure/db/schema';

const SETTINGS_ID = 1;

export class ZLibraryMirrorSettingsRepository {
	constructor(private readonly fallbackUrls: readonly string[]) {}

	async get(): Promise<string[]> {
		const [row] = await drizzleDb
			.select()
			.from(zlibraryMirrorSettings)
			.where(eq(zlibraryMirrorSettings.id, SETTINGS_ID))
			.limit(1);
		if (!row) return [...this.fallbackUrls];
		try {
			const value: unknown = JSON.parse(row.urlsJson);
			return Array.isArray(value) && value.every((url) => typeof url === 'string') && value.length > 0
				? value
				: [...this.fallbackUrls];
		} catch {
			return [...this.fallbackUrls];
		}
	}

	async replace(urls: readonly string[]): Promise<string[]> {
		const now = new Date().toISOString();
		await drizzleDb
			.insert(zlibraryMirrorSettings)
			.values({ id: SETTINGS_ID, urlsJson: JSON.stringify(urls), createdAt: now, updatedAt: now })
			.onConflictDoUpdate({ target: zlibraryMirrorSettings.id, set: { urlsJson: JSON.stringify(urls), updatedAt: now } });
		return [...urls];
	}
}
