interface CryptoSource {
	randomUUID?: () => string;
	getRandomValues?: (values: Uint8Array) => Uint8Array;
}

function fallbackByte(): number {
	return Math.floor(Math.random() * 256);
}

export function createReaderSessionId(cryptoSource: CryptoSource | undefined = globalThis.crypto): string {
	if (typeof cryptoSource?.randomUUID === 'function') {
		return cryptoSource.randomUUID();
	}

	const bytes = new Uint8Array(16);
	if (typeof cryptoSource?.getRandomValues === 'function') {
		cryptoSource.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = fallbackByte();
		}
	}

	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
