import type { DatabaseVersionInfo } from '$lib/types/App/AppVersion';

export function getDatabaseMigrationStatusNote(
	version: DatabaseVersionInfo | null,
	errorMessage: string | null,
	loading = false
): string | null {
	if (loading) {
		return null;
	}

	if (errorMessage || version?.status === 'unavailable') {
		return 'Could not inspect the database migration status right now.';
	}

	if (version?.status === 'outdated' || version?.status === 'untracked') {
		return 'Run bun run db:migrate or restart the sake-migrator container to bring the database schema up to date.';
	}

	return null;
}

export function shouldShowDatabaseMigrationWarning(
	version: DatabaseVersionInfo | null,
	errorMessage: string | null
): boolean {
	if (errorMessage) {
		return true;
	}

	return (
		version?.status === 'outdated' ||
		version?.status === 'untracked' ||
		version?.status === 'unavailable'
	);
}
