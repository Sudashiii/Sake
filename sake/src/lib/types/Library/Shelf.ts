import type { RuleGroup } from '$lib/types/Library/ShelfRule';

export interface LibraryShelf {
	id: number;
	name: string;
	icon: string;
	sortOrder: number;
	ruleGroup: RuleGroup;
	createdAt: string;
	updatedAt: string;
}
