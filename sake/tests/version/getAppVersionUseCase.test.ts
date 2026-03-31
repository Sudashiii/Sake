import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
	MigrationStatusPort,
	MigrationStatusSnapshot
} from '$lib/server/application/ports/MigrationStatusPort';
import { GetAppVersionUseCase } from '$lib/server/application/use-cases/GetAppVersionUseCase';

class StubMigrationStatusPort implements MigrationStatusPort {
	constructor(
		private readonly response:
			| MigrationStatusSnapshot
			| Error
	) {}

	async getSnapshot(): Promise<MigrationStatusSnapshot> {
		if (this.response instanceof Error) {
			throw this.response;
		}

		return this.response;
	}
}

describe('GetAppVersionUseCase', () => {
	test('marks the database as up to date when the latest applied migration matches the repo latest', async () => {
		const useCase = new GetAppVersionUseCase(
			new StubMigrationStatusPort({
				currentMigrationTag: '0019_book_publication_month_day',
				expectedMigrationTag: '0019_book_publication_month_day',
				currentMigrationIndex: 19,
				expectedMigrationIndex: 19
			})
		);

		const result = await useCase.execute({
			version: '2026.03.31.1',
			gitTag: 'webapp/v2026.03.31.1',
			commitSha: 'abc1234',
			releasedAt: '2026-03-31T18:00:00+02:00'
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(result.value.database, {
			status: 'up_to_date',
			currentMigrationTag: '0019_book_publication_month_day',
			expectedMigrationTag: '0019_book_publication_month_day',
			needsMigration: false
		});
	});

	test('marks the database as outdated when the applied migration is older than the repo latest', async () => {
		const useCase = new GetAppVersionUseCase(
			new StubMigrationStatusPort({
				currentMigrationTag: '0017_device_version_registry',
				expectedMigrationTag: '0019_book_publication_month_day',
				currentMigrationIndex: 17,
				expectedMigrationIndex: 19
			})
		);

		const result = await useCase.execute({
			version: '2026.03.31.1'
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(result.value.database, {
			status: 'outdated',
			currentMigrationTag: '0017_device_version_registry',
			expectedMigrationTag: '0019_book_publication_month_day',
			needsMigration: true
		});
	});

	test('marks the database as untracked when no migration rows are present', async () => {
		const useCase = new GetAppVersionUseCase(
			new StubMigrationStatusPort({
				currentMigrationTag: null,
				expectedMigrationTag: '0019_book_publication_month_day',
				currentMigrationIndex: null,
				expectedMigrationIndex: 19
			})
		);

		const result = await useCase.execute({
			version: '2026.03.31.1'
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(result.value.database, {
			status: 'untracked',
			currentMigrationTag: null,
			expectedMigrationTag: '0019_book_publication_month_day',
			needsMigration: true
		});
	});

	test('marks the database as untracked when the latest DB migration cannot be resolved to a known tag', async () => {
		const useCase = new GetAppVersionUseCase(
			new StubMigrationStatusPort({
				currentMigrationTag: null,
				expectedMigrationTag: '0019_book_publication_month_day',
				currentMigrationIndex: null,
				expectedMigrationIndex: 19
			})
		);

		const result = await useCase.execute({
			version: '2026.03.31.1'
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(result.value.database, {
			status: 'untracked',
			currentMigrationTag: null,
			expectedMigrationTag: '0019_book_publication_month_day',
			needsMigration: true
		});
	});

	test('returns database unavailable while still normalizing app version metadata when the lookup fails', async () => {
		const useCase = new GetAppVersionUseCase(
			new StubMigrationStatusPort(new Error('database offline'))
		);

		const result = await useCase.execute({
			version: ' 2026.03.31.1 ',
			gitTag: ' webapp/v2026.03.31.1 ',
			commitSha: ' abc1234 ',
			releasedAt: ' 2026-03-31T18:00:00+02:00 '
		});

		assert.equal(result.ok, true);
		if (!result.ok) {
			return;
		}

		assert.deepEqual(result.value, {
			version: '2026.03.31.1',
			gitTag: 'webapp/v2026.03.31.1',
			commitSha: 'abc1234',
			releasedAt: '2026-03-31T18:00:00+02:00',
			database: {
				status: 'unavailable',
				currentMigrationTag: null,
				expectedMigrationTag: null,
				needsMigration: null
			}
		});
	});
});
