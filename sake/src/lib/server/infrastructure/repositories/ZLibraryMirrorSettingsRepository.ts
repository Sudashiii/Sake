import { eq } from 'drizzle-orm';
import type { ZLibraryMirrorSettingsPort } from '$lib/server/application/ports/ZLibraryMirrorSettingsPort';
import { normalizeZLibraryMirrorUrls } from '$lib/server/config/zlibrary';
import { drizzleDb } from '$lib/server/infrastructure/db/client';
import { zlibraryMirrorSettings } from '$lib/server/infrastructure/db/schema';

const SETTINGS_ID = 1;

export class ZLibraryMirrorSettingsRepository implements ZLibraryMirrorSettingsPort {
	private readonly fallbackUrls: readonly string[];

	constructor(fallbackUrls: readonly string[]) {
		this.fallbackUrls = normalizeZLibraryMirrorUrls(fallbackUrls);
	}

	async get(): Promise<string[]> {
		const [row] = await drizzleDb
			.select()
			.from(zlibraryMirrorSettings)
			.where(eq(zlibraryMirrorSettings.id, SETTINGS_ID))
			.limit(1);
		if (!row) return [...this.fallbackUrls];
		try {
			const value: unknown = JSON.parse(row.urlsJson);
			if (!Array.isArray(value) || !value.every((url) => typeof url === 'string')) {
				return [...this.fallbackUrls];
			}
			return normalizeZLibraryMirrorUrls(value);
		} catch {
			return [...this.fallbackUrls];
		}
	}

	async replace(urls: readonly string[]): Promise<string[]> {
		const normalizedUrls = normalizeZLibraryMirrorUrls(urls);
		const now = new Date().toISOString();
		await drizzleDb
			.insert(zlibraryMirrorSettings)
			.values({ id: SETTINGS_ID, urlsJson: JSON.stringify(normalizedUrls), createdAt: now, updatedAt: now })
			.onConflictDoUpdate({
				target: zlibraryMirrorSettings.id,
				set: { urlsJson: JSON.stringify(normalizedUrls), updatedAt: now }
			});
		return [...normalizedUrls];
	}
}
