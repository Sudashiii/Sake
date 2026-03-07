import { type Result, ok, err } from '$lib/types/Result';
import { ApiErrors, type ApiError } from '$lib/types/ApiError';
import type { RuleGroup } from '$lib/types/Library/ShelfRule';
import type { LibraryShelf } from '$lib/types/Library/Shelf';

export interface UpdateLibraryShelfRulesResponse {
	success: boolean;
	shelf: LibraryShelf;
}

export async function updateLibraryShelfRules(
	shelfId: number,
	ruleGroup: RuleGroup
): Promise<Result<UpdateLibraryShelfRulesResponse, ApiError>> {
	try {
		const response = await fetch(`/api/library/shelves/${shelfId}/rules`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ ruleGroup })
		});

		if (!response.ok) {
			return err(await ApiErrors.fromResponse(response));
		}

		const data: UpdateLibraryShelfRulesResponse = await response.json();
		return ok(data);
	} catch (cause) {
		return err(ApiErrors.network('Network request failed', cause));
	}
}
