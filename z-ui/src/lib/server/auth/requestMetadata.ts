export function getRequestUserAgent(request: Request): string | null {
	const value = request.headers.get('user-agent')?.trim();
	return value ? value : null;
}

export function getRequestIp(request: Request): string | null {
	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		const [first] = forwardedFor.split(',');
		const value = first?.trim();
		if (value) {
			return value;
		}
	}

	const realIp = request.headers.get('x-real-ip')?.trim();
	return realIp ? realIp : null;
}
