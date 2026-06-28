import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { HardcoverProgressSyncPort } from '$lib/server/application/ports/HardcoverProgressSyncPort';
import {
	describeHardcoverSyncFailure,
	HardcoverProgressSyncService
} from '$lib/server/application/services/HardcoverProgressSyncService';
import type { Book } from '$lib/server/domain/entities/Book';
import {
	HardcoverClient,
	HardcoverClientError
} from '$lib/server/infrastructure/clients/HardcoverClient';
import type { HardcoverProgressSettingsRepository } from '$lib/server/infrastructure/repositories/HardcoverProgressSettingsRepository';
import type {
	HardcoverProgressJob,
	HardcoverProgressSyncJobRepository
} from '$lib/server/infrastructure/repositories/HardcoverProgressSyncJobRepository';
import { TriggerHardcoverProgressSyncUseCase } from '$lib/server/application/use-cases/TriggerHardcoverProgressSyncUseCase';

function book(): Book {
	return {
		id: 1,
		zLibId: null,
		s3_storage_key: 'book.epub',
		title: 'Book',
		author: 'Author',
		publisher: null,
		series: null,
		volume: null,
		series_index: null,
		edition: null,
		identifier: '9780000000002',
		pages: 100,
		description: null,
		google_books_id: null,
		open_library_key: null,
		hardcover_id: '42',
		amazon_asin: null,
		external_rating: null,
		external_rating_count: null,
		cover: null,
		extension: 'epub',
		filesize: null,
		language: null,
		year: null,
		month: null,
		day: null,
		progress_storage_key: 'book.sdr/metadata.epub.lua',
		progress_updated_at: '2026-06-14T10:00:00.000Z',
		progress_percent: 0.25,
		progress_before_read: null,
		rating: null,
		read_at: null,
		archived_at: null,
		exclude_from_new_books: false,
		createdAt: null,
		deleted_at: null,
		trash_expires_at: null
	};
}

function job(isInitialSync: boolean): HardcoverProgressJob {
	return {
		id: 7,
		bookId: 1,
		status: 'pending',
		sourceProgressPercent: 0.25,
		sourceProgressUpdatedAt: '2026-06-14T10:00:00.000Z',
		isInitialSync,
		hardcoverBookId: null,
		hardcoverUserBookId: null,
		attempts: 0,
		nextAttemptAt: null,
		error: null,
		outcome: null,
		createdAt: '2026-06-14T10:00:00.000Z',
		updatedAt: '2026-06-14T10:00:00.000Z',
		completedAt: null
	};
}

class ScriptedClient extends HardcoverClient {
	constructor(private readonly handler: (query: string, variables: Record<string, unknown>) => unknown) {
		super('test-token');
	}

	override async execute<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
		return this.handler(query, variables) as T;
	}
}

function dependencies(testJob: HardcoverProgressJob) {
	let nextJob: HardcoverProgressJob | null = testJob;
	let completed: { outcome: string } | null = null;
	let skipped: string | null = null;
	const enqueued: Array<{
		bookId: number;
		progressPercent: number;
		progressUpdatedAt: string | null;
		isInitialSync: boolean;
	}> = [];
	const repository = {
		getById: async () => book(),
		getAll: async () => [book()],
		updateHardcoverId: async () => {}
	} as unknown as BookRepositoryPort;
	const settings = {
		get: async () => ({ enabled: true, lastSuccessfulSyncAt: null }),
		markSuccessful: async () => {}
	} as unknown as HardcoverProgressSettingsRepository;
	const jobs = {
		getAll: async () => (nextJob ? [nextJob] : []),
		enqueue: async (input: (typeof enqueued)[number]) => {
			enqueued.push(input);
		},
		recoverProcessing: async () => {},
		claimNextDue: async () => {
			const value = nextJob;
			nextJob = null;
			return value;
		},
		markCompleted: async (_job: HardcoverProgressJob, value: { outcome: string }) => {
			completed = value;
			return true;
		},
		markSkipped: async (_job: HardcoverProgressJob, value: string) => {
			skipped = value;
			return true;
		},
		markFailed: async () => {
			throw new Error('Unexpected sync failure');
		},
		getNextWorkerWakeAt: async () => null
	} as unknown as HardcoverProgressSyncJobRepository;
	return {
		repository,
		settings,
		jobs,
		getCompleted: () => completed,
		getSkipped: () => skipped,
		getEnqueued: () => enqueued
	};
}

describe('HardcoverProgressSyncService', () => {
	test('formats actionable Hardcover failure messages', () => {
		assert.match(
			describeHardcoverSyncFailure(
				new HardcoverClientError('Hardcover API returned HTTP 401', 401, false, 'authentication')
			),
			/HARDCOVER_API_TOKEN/
		);
		assert.match(
			describeHardcoverSyncFailure(
				new HardcoverClientError('Hardcover API returned HTTP 429', 429, true, 'rate-limit')
			),
			/retry.*automatically/i
		);
		assert.match(
			describeHardcoverSyncFailure(
				new HardcoverClientError('permission denied', 502, false, 'graphql')
			),
			/denied permission.*API token/i
		);
		assert.match(
			describeHardcoverSyncFailure(
				new HardcoverClientError('invalid progress', 502, false, 'mutation')
			),
			/rejected the progress update.*retry/i
		);
		assert.doesNotMatch(
			describeHardcoverSyncFailure(
				new HardcoverClientError('internal field user_book_reads failed', 502, false, 'graphql')
			),
			/user_book_reads/
		);
	});

	test('ongoing sync authoritatively lowers progress and clears completion', async () => {
		const deps = dependencies(job(false));
		const captured: { readVariables: Record<string, unknown> | null } = { readVariables: null };
		const client = new ScriptedClient((query, variables) => {
			if (query.includes('SakeHardcoverProgressContext')) {
				return {
					books_by_pk: { id: 42, pages: 100, default_ebook_edition: { id: 9, pages: 100 } },
					me: [{
						user_books: [{
							id: 11,
							status_id: 3,
							user_book_status: { slug: 'read' },
							edition: { id: 9, pages: 100 },
							user_book_reads: [{ id: 12, progress_pages: 100, finished_at: '2026-06-01' }]
						}]
					}],
					user_book_statuses: [
						{ id: 2, slug: 'currently-reading' },
						{ id: 3, slug: 'read' }
					]
				};
			}
			if (query.includes('SakeUpdateHardcoverUserBook')) return { update_user_book: { id: 11 } };
			if (query.includes('SakeUpdateHardcoverRead')) {
				captured.readVariables = variables;
				return { update_user_book_read: { id: 12 } };
			}
			throw new Error('Unexpected query');
		});
		const service = new HardcoverProgressSyncService(
			deps.repository,
			deps.settings,
			deps.jobs,
			client
		);
		await service.processPending();
		assert.deepEqual((captured.readVariables?.read as Record<string, unknown>), {
			progress_pages: 25,
			finished_at: null,
			edition_id: 9
		});
		assert.equal(deps.getCompleted()?.outcome, 'progress_updated');
	});

	test('initial sync skips books that already have remote progress', async () => {
		const deps = dependencies(job(true));
		const client = new ScriptedClient((query) => {
			assert.match(query, /SakeHardcoverProgressContext/);
			return {
				books_by_pk: { id: 42, pages: 100 },
				me: [{
					user_books: [{
						id: 11,
						status_id: 2,
						user_book_status: { slug: 'currently-reading' },
						edition: null,
						user_book_reads: [{ id: 12, progress_pages: 10, finished_at: null }]
					}]
				}],
				user_book_statuses: []
			};
		});
		const service = new HardcoverProgressSyncService(
			deps.repository,
			deps.settings,
			deps.jobs,
			client
		);
		await service.processPending();
		assert.equal(deps.getSkipped(), 'remote_progress_exists');
		assert.equal(deps.getCompleted(), null);
	});

	test('initial sync ignores user books outside the authenticated account', async () => {
		const deps = dependencies(job(true));
		let createdLibraryEntry = false;
		const client = new ScriptedClient((query) => {
			if (query.includes('SakeHardcoverProgressContext')) {
				assert.match(query, /me\(limit: 1\)/);
				return {
					books_by_pk: { id: 42, pages: 100 },
					me: [{ user_books: [] }],
					user_book_statuses: [
						{ id: 2, slug: 'currently-reading' },
						{ id: 3, slug: 'read' }
					]
				};
			}
			if (query.includes('SakeCreateHardcoverUserBook')) {
				createdLibraryEntry = true;
				return { insert_user_book: { id: 11, user_book: { id: 11 } } };
			}
			if (query.includes('SakeInsertHardcoverRead')) {
				return { insert_user_book_read: { id: 12 } };
			}
			throw new Error('Unexpected query');
		});
		const service = new HardcoverProgressSyncService(
			deps.repository,
			deps.settings,
			deps.jobs,
			client
		);

		await service.processPending();

		assert.equal(createdLibraryEntry, true);
		assert.equal(deps.getSkipped(), null);
		assert.equal(deps.getCompleted()?.outcome, 'progress_updated');
	});

	test('reconciliation leaves an unchanged successful sync completed', async () => {
		const previousJob = {
			...job(true),
			status: 'completed' as const,
			outcome: 'progress_updated',
			hardcoverBookId: '42',
			hardcoverUserBookId: 11,
			completedAt: '2026-06-14T10:01:00.000Z'
		};
		const deps = dependencies(previousJob);
		deps.jobs.getAll = async () => [previousJob];
		const service = new HardcoverProgressSyncService(
			deps.repository,
			deps.settings,
			deps.jobs,
			new ScriptedClient(() => {
				throw new Error('Reconciliation should not call Hardcover');
			})
		);
		service.processPending = async () => {};

		const enqueued = await service.reconcile(true);

		assert.equal(enqueued, 0);
		assert.deepEqual(deps.getEnqueued(), []);
	});

	test('reconciliation repairs a false initial skip as an ongoing sync', async () => {
		const affectedJob = {
			...job(true),
			status: 'skipped' as const,
			outcome: 'remote_progress_exists',
			hardcoverBookId: '42',
			hardcoverUserBookId: 11,
			completedAt: '2026-06-14T10:01:00.000Z'
		};
		const deps = dependencies(affectedJob);
		deps.jobs.getAll = async () => [affectedJob];
		const service = new HardcoverProgressSyncService(
			deps.repository,
			deps.settings,
			deps.jobs,
			new ScriptedClient(() => {
				throw new Error('Background processing is outside this reconciliation test');
			})
		);
		service.processPending = async () => {};

		const enqueued = await service.reconcile(true);

		assert.equal(enqueued, 1);
		assert.deepEqual(deps.getEnqueued(), [{
			bookId: 1,
			progressPercent: 0.25,
			progressUpdatedAt: '2026-06-14T10:00:00.000Z',
			isInitialSync: false
		}]);
	});

	test('stays disabled until an explicit setting is stored', async () => {
		let recovered = false;
		const service = new HardcoverProgressSyncService(
			{ getAll: async () => [] } as unknown as BookRepositoryPort,
			{ get: async () => null } as unknown as HardcoverProgressSettingsRepository,
			{
				recoverProcessing: async () => {
					recovered = true;
				},
				getNextWorkerWakeAt: async () => null
			} as unknown as HardcoverProgressSyncJobRepository,
			new ScriptedClient(() => {
				throw new Error('Disabled sync must not call Hardcover');
			})
		);

		assert.equal(await service.isEnabled(), false);
		await service.processPending();
		assert.equal(recovered, false);
	});

	test('serializes simultaneous worker starts before the first settings read resolves', async () => {
		let activeClaims = 0;
		let maximumActiveClaims = 0;
		const service = new HardcoverProgressSyncService(
			{} as BookRepositoryPort,
			{
				get: async () => ({ enabled: true, lastSuccessfulSyncAt: null })
			} as HardcoverProgressSettingsRepository,
			{
				recoverProcessing: async () => {},
				claimNextDue: async () => {
					activeClaims += 1;
					maximumActiveClaims = Math.max(maximumActiveClaims, activeClaims);
					await new Promise((resolve) => setTimeout(resolve, 0));
					activeClaims -= 1;
					return null;
				},
				getNextWorkerWakeAt: async () => null
			} as unknown as HardcoverProgressSyncJobRepository,
			new ScriptedClient(() => {
				throw new Error('No job should reach Hardcover');
			})
		);

		await Promise.all([service.processPending(), service.processPending()]);
		await new Promise((resolve) => setTimeout(resolve, 10));

		assert.equal(maximumActiveClaims, 1);
	});

	test('manual trigger rejects a disabled integration', async () => {
		let reconciled = false;
		const sync = {
			isEnabled: async () => false,
			reconcile: async () => {
				reconciled = true;
				return 0;
			}
		} as unknown as HardcoverProgressSyncPort;
		const result = await new TriggerHardcoverProgressSyncUseCase(sync, true).execute();

		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.error.status, 409);
		assert.equal(reconciled, false);
	});
});
