import { error } from '@sveltejs/kit';
import { getLibraryBookDetailUseCase } from '$lib/server/application/composition';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const bookId = Number(params.id);
	if (!Number.isInteger(bookId) || bookId <= 0) {
		error(400, 'Invalid book id');
	}

	const result = await getLibraryBookDetailUseCase.execute({ bookId });
	if (!result.ok) {
		error(result.error.status, result.error.message);
	}
	if (result.value.extension?.toLowerCase() !== 'epub') {
		error(415, 'Web reader supports EPUB books only');
	}

	return { book: result.value };
};
