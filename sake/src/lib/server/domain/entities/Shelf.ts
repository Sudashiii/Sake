import type { RuleGroup } from '$lib/types/Library/ShelfRule';

export interface Shelf {
	id: number;
	name: string;
	icon: string;
	sortOrder: number;
	ruleGroup: RuleGroup;
	createdAt: string;
	updatedAt: string;
}

export interface CreateShelfInput {
	name: string;
	icon: string;
	ruleGroup: RuleGroup;
}

export interface UpdateShelfInput {
	name: string;
	icon: string;
	ruleGroup: RuleGroup;
}
