/**
 * Encodes an object into application/x-www-form-urlencoded format.
 * Arrays use bracket notation: key[]=value1&key[]=value2
 */
export function toUrlEncoded(data: object): string {
	const params: string[] = [];

	for (const [key, value] of Object.entries(data)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				params.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(String(item))}`);
			}
		} else if (value !== undefined && value !== null) {
			params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
		}
	}

	return params.join('&');
}
