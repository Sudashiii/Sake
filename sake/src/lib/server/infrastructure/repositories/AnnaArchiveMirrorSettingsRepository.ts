import { eq } from 'drizzle-orm';
import type { AnnaArchiveMirrorSettingsPort } from '$lib/server/application/ports/AnnaArchiveMirrorSettingsPort';
import { normalizeAnnaArchiveMirrorUrls } from '$lib/server/config/annaArchive';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { annaArchiveMirrorSettings } from '$lib/server/infrastructure/db/schema';

const SETTINGS_ID = 1;

export class AnnaArchiveMirrorSettingsRepository implements AnnaArchiveMirrorSettingsPort {
	private readonly fallbackUrls: readonly string[];

	constructor(fallbackUrls: readonly string[]) {
		this.fallbackUrls = normalizeAnnaArchiveMirrorUrls(fallbackUrls);
	}

	async get(): Promise<string[]> {
		const [row] = await drizzleDb
			.select()
			.from(annaArchiveMirrorSettings)
			.where(eq(annaArchiveMirrorSettings.id, SETTINGS_ID))
			.limit(1);
		if (!row) return [...this.fallbackUrls];
		try {
			const value: unknown = JSON.parse(row.urlsJson);
			if (!Array.isArray(value) || !value.every((url) => typeof url === 'string')) {
				return [...this.fallbackUrls];
			}
			return normalizeAnnaArchiveMirrorUrls(value);
		} catch {
			return [...this.fallbackUrls];
		}
	}

	async replace(urls: readonly string[]): Promise<string[]> {
		const normalizedUrls = normalizeAnnaArchiveMirrorUrls(urls);
		const now = new Date().toISOString();
		await drizzleDb
			.insert(annaArchiveMirrorSettings)
			.values({ id: SETTINGS_ID, urlsJson: JSON.stringify(normalizedUrls), createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: annaArchiveMirrorSettings.id,
				set: { urlsJson: JSON.stringify(normalizedUrls), updatedAt: now }
			});
		return [...normalizedUrls];
	}
}
