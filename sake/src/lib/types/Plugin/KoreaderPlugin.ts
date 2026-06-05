export type KoreaderPluginUpstreamStatus =
	| 'up_to_date'
	| 'outdated'
	| 'uploaded_newer'
	| 'unavailable';

export interface KoreaderPluginRelease {
	version: string;
	fileName: string;
	sha256: string;
	updatedAt: string;
	isLatest: boolean;
	downloadUrl: string;
}

export interface KoreaderPluginReleasesResponse {
	latestVersion: string;
	releases: KoreaderPluginRelease[];
}

export interface KoreaderPluginUpstreamVersionResponse {
	uploadedVersion: string | null;
	upstreamVersion: string | null;
	status: KoreaderPluginUpstreamStatus;
	sourceUrl: string;
	checkedAt: string;
}
