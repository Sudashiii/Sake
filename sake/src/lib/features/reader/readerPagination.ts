export function bookPageFromLocation(totalLocations: number, currentLocation: number): number | null {
	if (
		!Number.isFinite(totalLocations) ||
		!Number.isFinite(currentLocation) ||
		totalLocations < 1 ||
		currentLocation < 0
	) {
		return null;
	}

	return Math.min(Math.floor(totalLocations), Math.floor(currentLocation) + 1);
}
