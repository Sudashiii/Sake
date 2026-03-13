export const MAX_DEVICE_VERSION_LENGTH = 64;

export function normalizeDeviceVersion(value: string | null | undefined): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

export function isDeviceVersionTooLong(value: string): boolean {
	return value.length > MAX_DEVICE_VERSION_LENGTH;
}
