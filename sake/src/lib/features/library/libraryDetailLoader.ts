import { ZUI } from '$lib/client/zui';
import type { LibraryBook } from '$lib/types/Library/Book';

export async function loadLibraryBookDetail(bookId: number) {
	return ZUI.getLibraryBookDetail(bookId);
}

export function findBookByOpenBookId<TBook extends Pick<LibraryBook, 'id'>>(
	books: TBook[],
	openBookId: number | null
): TBook | null {
	if (openBookId === null) {
		return null;
	}

	return books.find((book) => book.id === openBookId) ?? null;
}
