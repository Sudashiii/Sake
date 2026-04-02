const RESERVED_DIRECT_LIBRARY_ROUTE_SEGMENTS = new Set([
	'list',
	'new',
	'ratings',
	'trash',
	'progress',
	'confirmDownload',
	'export',
	'shelves',
	'covers'
]);

export function isPublicApiRoute(pathname: string, method: string): boolean {
	if (pathname === '/api/app/version') {
		return method === 'GET';
	}

	if (pathname === '/api/library/ratings') {
		return method === 'GET';
	}

	if (pathname === '/api/auth/status') {
		return method === 'GET';
	}

	if (pathname === '/api/auth/bootstrap') {
		return method === 'POST';
	}

	if (pathname === '/api/auth/login') {
		return method === 'POST';
	}

	if (pathname === '/api/auth/device-key') {
		return method === 'POST';
	}

	if (pathname === '/api/auth/logout') {
		return method === 'POST';
	}

	if (pathname === '/api/plugin/koreader/latest') {
		return method === 'GET';
	}

	if (pathname === '/api/plugin/koreader/releases') {
		return method === 'GET';
	}

	if (pathname === '/api/plugin/koreader/download') {
		return method === 'GET';
	}

	return false;
}

export function isApiKeyAllowedRoute(pathname: string, method: string): boolean {
	if (pathname === '/api/library/new') {
		return method === 'GET';
	}
	if (pathname === '/api/library/confirmDownload') {
		return method === 'POST';
	}
	if (pathname === '/api/library/progress') {
		return method === 'GET' || method === 'PUT';
	}
	if (pathname === '/api/library/progress/new') {
		return method === 'GET';
	}
	if (pathname === '/api/library/progress/confirm') {
		return method === 'POST';
	}
	if (pathname === '/api/library/export') {
		return method === 'POST';
	}
	if (pathname === '/api/plugin/koreader/latest') {
		return method === 'GET';
	}
	if (pathname === '/api/plugin/koreader/releases') {
		return method === 'GET';
	}
	if (pathname === '/api/plugin/koreader/download') {
		return method === 'GET';
	}
	if (pathname === '/api/devices/version') {
		return method === 'POST';
	}
	if (pathname === '/api/devices/logs') {
		return method === 'POST';
	}
	if (pathname.startsWith('/api/library/covers/')) {
		return method === 'GET';
	}

	return isDirectLibraryFileRoute(pathname, method);
}

function isDirectLibraryFileRoute(pathname: string, method: string): boolean {
	if (method !== 'GET') {
		return false;
	}
	if (!pathname.startsWith('/api/library/')) {
		return false;
	}

	const segments = pathname.split('/').filter(Boolean);
	if (segments.length !== 3) {
		return false;
	}

	const lastSegment = segments[2];
	if (!lastSegment) {
		return false;
	}

	return !RESERVED_DIRECT_LIBRARY_ROUTE_SEGMENTS.has(lastSegment);
}

export function isStaticAssetPath(pathname: string): boolean {
	return pathname.startsWith('/_app/') || pathname === '/service-worker.js' || /\.[a-z0-9]+$/i.test(pathname);
}
