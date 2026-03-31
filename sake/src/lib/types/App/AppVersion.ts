export type DatabaseVersionStatus = 'up_to_date' | 'outdated' | 'untracked' | 'unavailable';

export interface WebappVersion {
	version: string;
	gitTag: string | null;
	commitSha: string | null;
	releasedAt: string | null;
}

export interface DatabaseVersionInfo {
	status: DatabaseVersionStatus;
	currentMigrationTag: string | null;
	expectedMigrationTag: string | null;
	needsMigration: boolean | null;
}

export interface AppVersionResponse extends WebappVersion {
	database: DatabaseVersionInfo;
}
