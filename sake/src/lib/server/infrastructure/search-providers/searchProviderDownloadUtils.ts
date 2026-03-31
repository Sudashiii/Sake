export function hasText(value: string | null | undefined): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

export function sanitizeFileNamePart(value: string): string {
	const normalized = value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^A-Za-z0-9._-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return normalized.length > 0 ? normalized : 'book';
}

export function sanitizeDownloadExtension(extension: string | null | undefined): string {
	const normalized = (extension ?? '').toLowerCase().trim();
	if (/^[a-z0-9]{1,12}$/.test(normalized)) {
		return normalized;
	}
	return 'epub';
}

export function normalizePreferredDownloadExtension(
	extension: string | null | undefined
): string {
	const normalized = sanitizeDownloadExtension(extension);
	if (normalized === 'pdf' || normalized === 'mobi' || normalized === 'azw3') {
		return normalized;
	}
	return 'epub';
}

export function buildDownloadFileName(title: string, extension: string): string {
	return `${sanitizeFileNamePart(title)}.${sanitizeDownloadExtension(extension)}`;
}

export function contentTypeForExtension(extension: string): string {
	switch (extension.toLowerCase()) {
		case 'pdf':
			return 'application/pdf';
		case 'mobi':
			return 'application/x-mobipocket-ebook';
		case 'azw3':
			return 'application/vnd.amazon.ebook';
		case 'fb2':
			return 'application/x-fictionbook+xml';
		case 'txt':
			return 'text/plain; charset=utf-8';
		case 'epub':
			return 'application/epub+zip';
		default:
			return 'application/octet-stream';
	}
}

export function parseUrl(input: string): URL | null {
	try {
		return new URL(input);
	} catch {
		return null;
	}
}

export function encodePath(path: string): string {
	return path
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

export function fileExtensionFromName(fileName: string): string | null {
	const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
	return match ? match[1] : null;
}

function sanitizeParsedFileName(value: string | null | undefined): string | null {
	if (!hasText(value)) {
		return null;
	}

	const sanitized = value
		.replace(/[\u0000-\u001f\u007f]/g, '')
		.trim()
		.replace(/^"+|"+$/g, '')
		.split(/[/\\]/)
		.pop()
		?.trim();

	if (!hasText(sanitized) || sanitized === '.' || sanitized === '..') {
		return null;
	}

	return sanitized;
}

export function parseContentDispositionFileName(headers: Headers): string | null {
	const raw = headers.get('content-disposition');
	if (!hasText(raw)) {
		return null;
	}

	const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match?.[1]) {
		try {
			return sanitizeParsedFileName(decodeURIComponent(utf8Match[1]));
		} catch {
			return sanitizeParsedFileName(utf8Match[1]);
		}
	}

	const quotedMatch = raw.match(/filename="([^"]+)"/i);
	if (quotedMatch?.[1]) {
		return sanitizeParsedFileName(quotedMatch[1]);
	}

	const plainMatch = raw.match(/filename=([^;]+)/i);
	return sanitizeParsedFileName(plainMatch?.[1] ?? null);
}
