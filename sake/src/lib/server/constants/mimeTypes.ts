export const mimeTypes: Record<string, string> = {
	epub: 'application/epub+zip',
	pdf: 'application/pdf',
	mobi: 'application/x-mobipocket-ebook',
	cbr: 'application/x-cbr', // Comic Book RAR
	cbz: 'application/x-cbz', // Comic Book ZIP
	lua: 'text/plain',

    // Images
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',

    // Fallback
	default: 'application/octet-stream'
};