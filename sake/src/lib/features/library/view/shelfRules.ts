import type { LibraryBook } from '$lib/types/Library/Book';
import type { LibraryShelf } from '$lib/types/Library/Shelf';
import type { RuleGroup, RuleNode, ShelfCondition } from '$lib/types/Library/ShelfRule';
import { getBookStatus, getProgressPercent } from './filtering';

export function getRuleFieldValue(book: LibraryBook, field: ShelfCondition['field']): string | number | null {
	if (field === 'title') return book.title;
	if (field === 'author') return book.author ?? null;
	if (field === 'series') return book.series ?? null;
	if (field === 'format') return book.extension ?? null;
	if (field === 'language') return book.language ?? null;
	if (field === 'status') return getBookStatus(book);
	if (field === 'seriesIndex') return book.series_index ?? null;
	if (field === 'rating') return book.rating;
	if (field === 'readingProgress') return getProgressPercent(book);
	if (field === 'year') return book.year ?? null;
	if (field === 'pages') return book.pages ?? null;
	return null;
}

export function evaluateCondition(book: LibraryBook, condition: ShelfCondition): boolean {
	const raw = getRuleFieldValue(book, condition.field);
	if (raw === null || raw === undefined) {
		return false;
	}

	const bookString = String(raw).toLowerCase();
	const ruleString = condition.value.toLowerCase();
	const bookNumber = Number(raw);
	const ruleNumber = Number(condition.value);
	const isNumeric = !Number.isNaN(bookNumber) && !Number.isNaN(ruleNumber);

	if (condition.operator === 'equals') {
		return isNumeric ? bookNumber === ruleNumber : bookString === ruleString;
	}
	if (condition.operator === 'not_equals') {
		return isNumeric ? bookNumber !== ruleNumber : bookString !== ruleString;
	}
	if (condition.operator === 'contains') {
		return bookString.includes(ruleString);
	}
	if (condition.operator === 'not_contains') {
		return !bookString.includes(ruleString);
	}
	if (condition.operator === 'gt') {
		return isNumeric && bookNumber > ruleNumber;
	}
	if (condition.operator === 'lt') {
		return isNumeric && bookNumber < ruleNumber;
	}
	if (condition.operator === 'gte') {
		return isNumeric && bookNumber >= ruleNumber;
	}
	if (condition.operator === 'lte') {
		return isNumeric && bookNumber <= ruleNumber;
	}

	return false;
}

export function evaluateRuleNode(book: LibraryBook, node: RuleNode): boolean {
	if (node.type === 'condition') {
		return evaluateCondition(book, node);
	}
	if (node.children.length === 0) {
		return false;
	}
	if (node.connector === 'AND') {
		return node.children.every((child) => evaluateRuleNode(book, child));
	}
	return node.children.some((child) => evaluateRuleNode(book, child));
}

export function evaluateRuleGroup(book: LibraryBook, group: RuleGroup): boolean {
	if (group.children.length === 0) {
		return false;
	}
	return evaluateRuleNode(book, group);
}

export function matchesBookShelf(
	book: LibraryBook,
	shelfId: number | null,
	shelvesById?: Map<number, LibraryShelf>
): boolean {
	if (shelfId === null) {
		return true;
	}

	const manualMatch = book.shelfIds.includes(shelfId);
	const shelf = shelvesById?.get(shelfId);
	if (!shelf) {
		return manualMatch;
	}

	const rulesMatch =
		shelf.ruleGroup.children.length > 0 ? evaluateRuleGroup(book, shelf.ruleGroup) : false;
	return manualMatch || rulesMatch;
}
