import type { LibraryBook } from '$lib/types/Library/Book';
import type { LibraryBulkShelfAction } from './types';

export function toggleBookSelection(selectedBookIds: number[], bookId: number): number[] {
	if (selectedBookIds.includes(bookId)) {
		return selectedBookIds.filter((id) => id !== bookId);
	}

	return [...selectedBookIds, bookId].sort((a, b) => a - b);
}

export function getVisibleBookIds(books: LibraryBook[]): number[] {
	return books.map((book) => book.id).sort((a, b) => a - b);
}

export function pruneBookSelection(selectedBookIds: number[], visibleBookIds: number[]): number[] {
	const visibleIdSet = new Set(visibleBookIds);
	return selectedBookIds.filter((id) => visibleIdSet.has(id)).sort((a, b) => a - b);
}

export function applyBulkShelfSelection(
	currentShelfIds: number[],
	shelfId: number,
	action: LibraryBulkShelfAction
): number[] {
	const uniqueShelfIds = [...new Set(currentShelfIds)];
	if (action === 'add') {
		return uniqueShelfIds.includes(shelfId)
			? uniqueShelfIds.sort((a, b) => a - b)
			: [...uniqueShelfIds, shelfId].sort((a, b) => a - b);
	}

	return uniqueShelfIds.filter((id) => id !== shelfId).sort((a, b) => a - b);
}
