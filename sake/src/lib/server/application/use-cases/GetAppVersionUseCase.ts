import type { MigrationStatusPort, MigrationStatusSnapshot } from '$lib/server/application/ports/MigrationStatusPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';
import type { AppVersionResponse, DatabaseVersionInfo } from '$lib/types/App/AppVersion';
import { createWebappVersion, type WebappVersionInput } from '$lib/webappVersion';

function resolveDatabaseVersion(snapshot: MigrationStatusSnapshot): DatabaseVersionInfo {
	if (!snapshot.currentMigrationTag || snapshot.currentMigrationIndex === null) {
		return {
			status: 'untracked',
			currentMigrationTag: null,
			expectedMigrationTag: snapshot.expectedMigrationTag,
			needsMigration: true
		};
	}

	if (
		snapshot.currentMigrationIndex === snapshot.expectedMigrationIndex &&
		snapshot.currentMigrationTag === snapshot.expectedMigrationTag
	) {
		return {
			status: 'up_to_date',
			currentMigrationTag: snapshot.currentMigrationTag,
			expectedMigrationTag: snapshot.expectedMigrationTag,
			needsMigration: false
		};
	}

	return {
		status: 'outdated',
		currentMigrationTag: snapshot.currentMigrationTag,
		expectedMigrationTag: snapshot.expectedMigrationTag,
		needsMigration: true
	};
}

export class GetAppVersionUseCase {
	private readonly useCaseLogger = createChildLogger({ useCase: 'GetAppVersionUseCase' });

	constructor(private readonly migrationStatusPort: MigrationStatusPort) {}

	async execute(input: WebappVersionInput): Promise<ApiResult<AppVersionResponse>> {
		const version = createWebappVersion(input);

		try {
			const snapshot = await this.migrationStatusPort.getSnapshot();
			return apiOk({
				...version,
				database: resolveDatabaseVersion(snapshot)
			});
		} catch (err: unknown) {
			this.useCaseLogger.warn(
				{ event: 'app.version.database_status_unavailable', error: toLogError(err) },
				'Database migration status unavailable while resolving app version'
			);

			return apiOk({
				...version,
				database: {
					status: 'unavailable',
					currentMigrationTag: null,
					expectedMigrationTag: null,
					needsMigration: null
				}
			});
		}
	}
}
