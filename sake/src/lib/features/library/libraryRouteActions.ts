import { toastStore } from '$lib/client/stores/toastStore.svelte';
import { ZUI } from '$lib/client/zui';
import type { LibraryBook } from '$lib/types/Library/Book';

type RouteActionResult = { ok: true } | { ok: false };

export async function restoreLibraryBookAction(
	book: Pick<LibraryBook, 'id' | 'title'>,
	successMessage = `"${book.title}" restored to library`
): Promise<RouteActionResult> {
	const result = await ZUI.restoreLibraryBook(book.id);
	if (!result.ok) {
		toastStore.add(`Failed to restore "${book.title}": ${result.error.message}`, 'error');
		return { ok: false };
	}

	if (successMessage) {
		toastStore.add(successMessage, 'success');
	}
	return { ok: true };
}

export async function deleteTrashedLibraryBookAction(
	book: Pick<LibraryBook, 'id' | 'title'>,
	successMessage = `"${book.title}" permanently deleted`
): Promise<RouteActionResult> {
	const result = await ZUI.deleteTrashedLibraryBook(book.id);
	if (!result.ok) {
		toastStore.add(`Failed to delete "${book.title}": ${result.error.message}`, 'error');
		return { ok: false };
	}

	if (successMessage) {
		toastStore.add(successMessage, 'success');
	}
	return { ok: true };
}

export async function unarchiveLibraryBookAction(
	book: Pick<LibraryBook, 'id' | 'title'>,
	successMessage = `"${book.title}" restored to library`
): Promise<RouteActionResult> {
	const result = await ZUI.updateLibraryBookState(book.id, { archived: false });
	if (!result.ok) {
		toastStore.add(`Failed to restore "${book.title}": ${result.error.message}`, 'error');
		return { ok: false };
	}

	if (successMessage) {
		toastStore.add(successMessage, 'success');
	}
	return { ok: true };
}
