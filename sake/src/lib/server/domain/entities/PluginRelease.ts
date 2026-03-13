export interface PluginRelease {
	id: number;
	version: string;
	fileName: string;
	storageKey: string;
	sha256: string;
	isLatest: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface UpsertPluginReleaseInput {
	version: string;
	fileName: string;
	storageKey: string;
	sha256: string;
}
