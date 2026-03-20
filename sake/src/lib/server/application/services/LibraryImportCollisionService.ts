import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { Book } from '$lib/server/domain/entities/Book';

export type LibraryImportOutcome = 'created' | 'duplicate' | 'restored' | 'repaired';

export interface LibraryImportMatch {
	book: Book;
	matchedBy: 'zLibId' | 'storageKey';
}

type CollisionRepository = Pick<
	BookRepositoryPort,
	'getByZLibIdIncludingTrashed' | 'getByStorageKeyIncludingTrashed'
>;

export class LibraryImportCollisionService {
	constructor(private readonly bookRepository: CollisionRepository) {}

	async findZLibraryMatch(
		zLibId: string,
		storageKey: string
	): Promise<LibraryImportMatch | null> {
		const byZLibId = await this.bookRepository.getByZLibIdIncludingTrashed(zLibId);
		if (byZLibId) {
			return { book: byZLibId, matchedBy: 'zLibId' };
		}

		const byStorageKey = await this.bookRepository.getByStorageKeyIncludingTrashed(storageKey);
		if (byStorageKey) {
			return { book: byStorageKey, matchedBy: 'storageKey' };
		}

		return null;
	}

	async findStorageKeyMatch(storageKey: string): Promise<LibraryImportMatch | null> {
		const byStorageKey = await this.bookRepository.getByStorageKeyIncludingTrashed(storageKey);
		if (byStorageKey) {
			return { book: byStorageKey, matchedBy: 'storageKey' };
		}

		return null;
	}
}
