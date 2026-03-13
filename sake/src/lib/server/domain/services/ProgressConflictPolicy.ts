export function isIncomingProgressOlder(
	existingLatest: string | null,
	incomingLatest: string | null
): boolean {
	return Boolean(existingLatest && incomingLatest && incomingLatest < existingLatest);
}
