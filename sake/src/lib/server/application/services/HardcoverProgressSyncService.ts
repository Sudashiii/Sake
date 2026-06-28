import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { HardcoverProgressSyncPort } from '$lib/server/application/ports/HardcoverProgressSyncPort';
import type { Book } from '$lib/server/domain/entities/Book';
import {
	HardcoverClient,
	HardcoverClientError
} from '$lib/server/infrastructure/clients/HardcoverClient';
import { createChildLogger, toLogError } from '$lib/server/infrastructure/logging/logger';
import {
	HardcoverProgressSettingsRepository
} from '$lib/server/infrastructure/repositories/HardcoverProgressSettingsRepository';
import {
	HardcoverProgressSyncJobRepository,
	type HardcoverProgressJob
} from '$lib/server/infrastructure/repositories/HardcoverProgressSyncJobRepository';

const BOOK_CONTEXT_QUERY = /* GraphQL */ `
	query SakeHardcoverProgressContext($bookId: Int!) {
		books_by_pk(id: $bookId) {
			id
			pages
			default_ebook_edition { id pages }
		}
		me(limit: 1) {
			user_books(where: { book_id: { _eq: $bookId } }, limit: 1) {
				id
				status_id
				user_book_status { slug }
				edition { id pages }
				user_book_reads(order_by: { id: desc }, limit: 1) {
					id
					progress
					progress_pages
					finished_at
					edition_id
				}
			}
		}
		user_book_statuses { id slug }
	}
`;

const PROCESSING_LEASE_MS = 5 * 60 * 1000;

const ISBN_QUERY = /* GraphQL */ `
	query SakeHardcoverExactIsbn($isbn: String!) {
		editions(
			where: {
				_or: [
					{ isbn_10: { _eq: $isbn } }
					{ isbn_13: { _eq: $isbn } }
				]
			}
			limit: 10
		) {
			id
			pages
			book_id
		}
	}
`;

const CREATE_USER_BOOK_MUTATION = /* GraphQL */ `
	mutation SakeCreateHardcoverUserBook($object: UserBookCreateInput!) {
		insert_user_book(object: $object) {
			error
			id
			user_book { id }
		}
	}
`;

const UPDATE_USER_BOOK_MUTATION = /* GraphQL */ `
	mutation SakeUpdateHardcoverUserBook($id: Int!, $object: UserBookUpdateInput!) {
		update_user_book(id: $id, object: $object) {
			error
			id
		}
	}
`;

const INSERT_READ_MUTATION = /* GraphQL */ `
	mutation SakeInsertHardcoverRead($userBookId: Int!, $read: DatesReadInput!) {
		insert_user_book_read(user_book_id: $userBookId, user_book_read: $read) {
			error
			id
		}
	}
`;

const UPDATE_READ_MUTATION = /* GraphQL */ `
	mutation SakeUpdateHardcoverRead($id: Int!, $read: DatesReadInput!) {
		update_user_book_read(id: $id, object: $read) {
			error
			id
		}
	}
`;

interface HardcoverContext {
	books_by_pk?: {
		id: number;
		pages?: number | null;
		default_ebook_edition?: { id: number; pages?: number | null } | null;
	} | null;
	me?: Array<{
		user_books?: Array<{
			id: number;
			status_id: number;
			user_book_status?: { slug?: string | null } | null;
			edition?: { id: number; pages?: number | null } | null;
			user_book_reads?: Array<{
				id: number;
				progress?: number | null;
				progress_pages?: number | null;
				finished_at?: string | null;
				edition_id?: number | null;
			}>;
		}>;
	}>;
	user_book_statuses?: Array<{ id: number; slug?: string | null }>;
}

interface ExactIsbnResult {
	editions?: Array<{ id: number; pages?: number | null; book_id: number }>;
}

type HardcoverBookResolution =
	| { kind: 'found'; hardcoverBookId: string }
	| { kind: 'skipped'; skipOutcome: string };

function isDemoMode(): boolean {
	return /^(1|true|yes|on)$/i.test(process.env.SAKE_DEMO_MODE?.trim() ?? '');
}

function normalizeIsbn(value: string | null): string | null {
	if (!value) return null;
	const normalized = value.replace(/[^0-9X]/gi, '').toUpperCase();
	return normalized.length === 10 || normalized.length === 13 ? normalized : null;
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function positiveInteger(value: number | null | undefined): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
		? Math.round(value)
		: null;
}

function hasSameSourceProgress(
	job: HardcoverProgressJob,
	progressPercent: number,
	progressUpdatedAt: string | null
): boolean {
	return (
		job.sourceProgressPercent === progressPercent &&
		job.sourceProgressUpdatedAt === progressUpdatedAt
	);
}

function isSuccessfulSync(job: HardcoverProgressJob): boolean {
	return (
		job.status === 'completed' &&
		(job.outcome === 'progress_updated' || job.outcome === 'marked_read')
	);
}

export function describeHardcoverSyncFailure(cause: unknown): string {
	if (!(cause instanceof HardcoverClientError)) {
		return 'Hardcover sync failed unexpectedly. Review the server logs, then retry the job.';
	}
	if (cause.kind === 'authentication') {
		return 'Hardcover rejected the configured API token. Update HARDCOVER_API_TOKEN, restart Sake, and retry.';
	}
	if (cause.kind === 'rate-limit') {
		return 'Hardcover rate limit reached. Sake will retry this job automatically.';
	}
	if (cause.kind === 'timeout') {
		return 'Hardcover did not respond within 30 seconds. Sake will retry this job automatically.';
	}
	if (cause.kind === 'network') {
		return 'Sake could not reach Hardcover. Check the server network connection; Sake will retry automatically.';
	}
	if (cause.kind === 'invalid-response') {
		return 'Hardcover returned an incomplete response. Sake will retry this job automatically.';
	}
	if (cause.kind === 'configuration') {
		return cause.message;
	}
	if (cause.kind === 'mutation') {
		return 'Hardcover rejected the progress update. Refresh the book metadata or Hardcover link, then retry.';
	}
	if (cause.kind === 'graphql') {
		if (/permission|forbidden|not authorized|unauthorized/i.test(cause.message)) {
			return 'Hardcover denied permission for this sync operation. Verify the configured API token and retry.';
		}
		return cause.isRetryable
			? 'Hardcover temporarily rejected the GraphQL request. Sake will retry this job automatically.'
			: 'Hardcover rejected the GraphQL request. Review the server logs for details, then retry.';
	}
	return cause.isRetryable
		? `Hardcover is temporarily unavailable (${cause.message}). Sake will retry this job automatically.`
		: `Hardcover rejected the sync request: ${cause.message}`;
}

export class HardcoverProgressSyncService implements HardcoverProgressSyncPort {
	private isProcessing = false;
	private shouldProcessAgain = false;
	private workerWakeTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly logger = createChildLogger({ service: 'HardcoverProgressSyncService' });

	constructor(
		private readonly bookRepository: BookRepositoryPort,
		private readonly settingsRepository: HardcoverProgressSettingsRepository,
		private readonly jobRepository: HardcoverProgressSyncJobRepository,
		private readonly client: HardcoverClient | null
	) {}

	async isEnabled(): Promise<boolean> {
		if (!this.client || isDemoMode()) return false;
		return (await this.settingsRepository.get())?.enabled ?? false;
	}

	async enqueueBook(bookId: number, isInitialSync = false): Promise<void> {
		if (!(await this.isEnabled())) return;
		const book = await this.bookRepository.getById(bookId);
		if (!book || typeof book.progress_percent !== 'number') return;
		await this.jobRepository.enqueue({
			bookId,
			progressPercent: Math.max(0, Math.min(1, book.progress_percent)),
			progressUpdatedAt: book.progress_updated_at,
			isInitialSync
		});
		this.requestProcessing();
	}

	async reconcile(isInitialSync = false): Promise<number> {
		if (!(await this.isEnabled())) return 0;
		const [books, jobs] = await Promise.all([
			this.bookRepository.getAll(),
			this.jobRepository.getAll()
		]);
		const jobsByBookId = new Map(jobs.map((job) => [job.bookId, job]));
		const candidates = books.filter((book) => typeof book.progress_percent === 'number');
		let enqueued = 0;
		for (const book of candidates) {
			const progressPercent = Math.max(0, Math.min(1, book.progress_percent ?? 0));
			const existingJob = jobsByBookId.get(book.id) ?? null;
			const hasSameProgress =
				existingJob !== null &&
				hasSameSourceProgress(existingJob, progressPercent, book.progress_updated_at);
			if (
				hasSameProgress &&
				(existingJob.status === 'pending' ||
					existingJob.status === 'processing' ||
					isSuccessfulSync(existingJob))
			) {
				continue;
			}

			await this.jobRepository.enqueue({
				bookId: book.id,
				progressPercent,
				progressUpdatedAt: book.progress_updated_at,
				isInitialSync: isInitialSync && existingJob?.hardcoverUserBookId == null
			});
			enqueued += 1;
		}
		this.requestProcessing();
		return enqueued;
	}

	async processPending(): Promise<void> {
		if (this.isProcessing) {
			this.shouldProcessAgain = true;
			return;
		}
		if (!this.client) return;
		this.isProcessing = true;
		this.clearWorkerWakeTimer();
		try {
			if (!(await this.isEnabled())) return;
			const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS).toISOString();
			await this.jobRepository.recoverProcessing(staleBefore);
			while (await this.isEnabled()) {
				const job = await this.jobRepository.claimNextDue();
				if (!job) break;
				try {
					await this.processJob(job);
				} catch (cause: unknown) {
					const error = describeHardcoverSyncFailure(cause);
					const isRetryable =
						cause instanceof HardcoverClientError ? cause.isRetryable : true;
					await this.jobRepository.markFailed(job, error, isRetryable);
					this.logger.error(
						{ event: 'hardcover.progress_sync.failed', bookId: job.bookId, error: toLogError(cause) },
						'Hardcover progress sync failed'
					);
				}
			}
		} finally {
			this.isProcessing = false;
			if (this.shouldProcessAgain) {
				this.shouldProcessAgain = false;
				this.requestProcessing();
			} else {
				await this.scheduleNextWorkerWake();
			}
		}
	}

	private async processJob(job: HardcoverProgressJob): Promise<void> {
		const book = await this.bookRepository.getById(job.bookId);
		if (!book) {
			await this.jobRepository.markSkipped(job, 'book_not_found');
			return;
		}

		const resolution = await this.resolveHardcoverBookId(book);
		if (resolution.kind === 'skipped') {
			await this.jobRepository.markSkipped(job, resolution.skipOutcome);
			return;
		}
		const hardcoverBookId = resolution.hardcoverBookId;

		const context = await this.client!.execute<HardcoverContext>(BOOK_CONTEXT_QUERY, {
			bookId: Number(hardcoverBookId)
		});
		const remoteBook = context.books_by_pk;
		if (!remoteBook) {
			await this.jobRepository.markSkipped(job, 'hardcover_book_not_found');
			return;
		}

		let userBook = context.me?.[0]?.user_books?.[0] ?? null;
		const existingRead = userBook?.user_book_reads?.[0] ?? null;
		const isRemoteRead = userBook?.user_book_status?.slug === 'read' || Boolean(existingRead?.finished_at);
		const hasRemoteProgress =
			positiveInteger(existingRead?.progress_pages) !== null ||
			(typeof existingRead?.progress === 'number' && existingRead.progress > 0);
		if (job.isInitialSync && (isRemoteRead || hasRemoteProgress)) {
			await this.jobRepository.markSkipped(job, 'remote_progress_exists');
			return;
		}

		const editionId =
			userBook?.edition?.id ?? remoteBook.default_ebook_edition?.id ?? null;
		const totalPages =
			positiveInteger(userBook?.edition?.pages) ??
			positiveInteger(remoteBook.default_ebook_edition?.pages) ??
			positiveInteger(remoteBook.pages) ??
			positiveInteger(book.pages);
		if (!totalPages) {
			await this.jobRepository.markSkipped(job, 'page_count_unavailable');
			return;
		}

		const statusSlug = job.sourceProgressPercent >= 1 ? 'read' : 'currently-reading';
		const statusId = context.user_book_statuses?.find((status) => status.slug === statusSlug)?.id;
		if (!statusId) {
			throw new HardcoverClientError(
				`Hardcover does not provide the required "${statusSlug}" reading status for this account.`,
				502,
				false,
				'configuration'
			);
		}

		if (!userBook) {
			const created = await this.client!.execute<{
				insert_user_book?: { error?: string | null; id?: number | null; user_book?: { id: number } | null };
			}>(CREATE_USER_BOOK_MUTATION, {
				object: {
					book_id: remoteBook.id,
					status_id: statusId,
					...(editionId ? { edition_id: editionId } : {})
				}
			});
			const mutation = created.insert_user_book;
			if (mutation?.error || !(mutation?.user_book?.id ?? mutation?.id)) {
				throw new HardcoverClientError(
					mutation?.error ?? 'Could not create the book in the Hardcover library.',
					502,
					false,
					'mutation'
				);
			}
			userBook = {
				id: mutation.user_book?.id ?? mutation.id!,
				status_id: statusId,
				user_book_status: { slug: statusSlug },
				edition: editionId ? { id: editionId, pages: totalPages } : null,
				user_book_reads: []
			};
		} else {
			const updated = await this.client!.execute<{
				update_user_book?: { error?: string | null; id?: number | null };
			}>(UPDATE_USER_BOOK_MUTATION, {
				id: userBook.id,
				object: {
					status_id: statusId,
					...(editionId ? { edition_id: editionId } : {}),
					...(job.sourceProgressPercent >= 1 ? { last_read_date: today() } : {})
				}
			});
			if (updated.update_user_book?.error) {
				throw new HardcoverClientError(
					updated.update_user_book.error,
					502,
					false,
					'mutation'
				);
			}
		}

		const progressPages = Math.max(0, Math.min(totalPages, Math.round(totalPages * job.sourceProgressPercent)));
		const readInput = {
			progress_pages: progressPages,
			finished_at: job.sourceProgressPercent >= 1 ? today() : null,
			...(editionId ? { edition_id: editionId } : {}),
			...(!existingRead ? { started_at: today() } : {})
		};
		let readError: string | null | undefined;
		if (existingRead) {
			const readResult = await this.client!.execute<{
				update_user_book_read?: { error?: string | null };
			}>(UPDATE_READ_MUTATION, { id: existingRead.id, read: readInput });
			readError = readResult.update_user_book_read?.error;
		} else {
			const readResult = await this.client!.execute<{
				insert_user_book_read?: { error?: string | null };
			}>(INSERT_READ_MUTATION, { userBookId: userBook.id, read: readInput });
			readError = readResult.insert_user_book_read?.error;
		}
		if (readError) {
			throw new HardcoverClientError(readError, 502, false, 'mutation');
		}

		const completed = await this.jobRepository.markCompleted(job, {
			hardcoverBookId,
			hardcoverUserBookId: userBook.id,
			outcome: job.sourceProgressPercent >= 1 ? 'marked_read' : 'progress_updated'
		});
		if (completed) {
			await this.settingsRepository.markSuccessful(new Date().toISOString());
		}
	}

	private requestProcessing(): void {
		void this.processPending().catch((cause: unknown) => {
			this.logger.error(
				{ event: 'hardcover.progress_sync.worker_failed', error: toLogError(cause) },
				'Hardcover progress worker failed'
			);
		});
	}

	private clearWorkerWakeTimer(): void {
		if (this.workerWakeTimer === null) return;
		clearTimeout(this.workerWakeTimer);
		this.workerWakeTimer = null;
	}

	private async scheduleNextWorkerWake(): Promise<void> {
		this.clearWorkerWakeTimer();
		if (!(await this.isEnabled())) return;
		const wakeAt = await this.jobRepository.getNextWorkerWakeAt(PROCESSING_LEASE_MS);
		if (!wakeAt) return;
		const delayMs = Math.max(0, new Date(wakeAt).getTime() - Date.now()) + 100;
		this.workerWakeTimer = setTimeout(() => {
			this.workerWakeTimer = null;
			this.requestProcessing();
		}, delayMs);
	}

	private async resolveHardcoverBookId(book: Book): Promise<HardcoverBookResolution> {
		const stored = book.hardcover_id?.trim();
		if (stored && /^\d+$/.test(stored)) return { kind: 'found', hardcoverBookId: stored };
		const isbn = normalizeIsbn(book.identifier);
		if (!isbn) return { kind: 'skipped', skipOutcome: 'isbn_unavailable' };
		const result = await this.client!.execute<ExactIsbnResult>(ISBN_QUERY, { isbn });
		const bookIds = [...new Set((result.editions ?? []).map((edition) => edition.book_id))];
		if (bookIds.length === 0) {
			return { kind: 'skipped', skipOutcome: 'no_exact_hardcover_match' };
		}
		if (bookIds.length > 1) {
			return { kind: 'skipped', skipOutcome: 'ambiguous_hardcover_match' };
		}
		const hardcoverId = String(bookIds[0]);
		await this.bookRepository.updateHardcoverId(book.id, hardcoverId);
		return { kind: 'found', hardcoverBookId: hardcoverId };
	}
}
