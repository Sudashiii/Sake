export interface MigrationStatusSnapshot {
	currentMigrationTag: string | null;
	expectedMigrationTag: string;
	currentMigrationIndex: number | null;
	expectedMigrationIndex: number;
}

export interface MigrationStatusPort {
	getSnapshot(): Promise<MigrationStatusSnapshot>;
}
