import JSZip from 'jszip';
import path from 'node:path';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';

const CONTAINER_PATH = 'META-INF/container.xml';
const MIMETYPE_PATH = 'mimetype';
const EPUB_MIMETYPE = 'application/epub+zip';
const ROOTFILE_PATH_REGEX = /<rootfile\b[^>]*\bfull-path\s*=\s*(["'])([^"']+)\1/i;
const DC_TITLE_REGEX = /<dc:title\b([^>]*)>[\s\S]*?<\/dc:title>/i;
const SPINE_TOC_ID_REGEX = /<spine\b[^>]*\btoc\s*=\s*(["'])([^"']+)\1/i;
const ITEM_TAG_REGEX = /<item\b[^>]*>/gi;
const DOC_TITLE_TEXT_REGEX =
	/(<docTitle\b[^>]*>[\s\S]*?<text\b[^>]*>)[\s\S]*?(<\/text>[\s\S]*?<\/docTitle>)/i;

function getXmlAttribute(tag: string, name: string): string | null {
	const regex = new RegExp(`\\b${name}\\s*=\\s*([\"'])([^\"']+)\\1`, 'i');
	const match = tag.match(regex);
	return match?.[2] ?? null;
}

function resolveNcxPathFromOpf(opfXml: string, opfPath: string): string | null {
	const opfDir = path.posix.dirname(opfPath);
	const itemTags = opfXml.match(ITEM_TAG_REGEX) ?? [];
	const spineTocId = opfXml.match(SPINE_TOC_ID_REGEX)?.[2] ?? null;

	let ncxHref: string | null = null;

	if (spineTocId) {
		for (const itemTag of itemTags) {
			const id = getXmlAttribute(itemTag, 'id');
			if (id !== spineTocId) {
				continue;
			}

			ncxHref = getXmlAttribute(itemTag, 'href');
			break;
		}
	}

	if (!ncxHref) {
		for (const itemTag of itemTags) {
			const mediaType = getXmlAttribute(itemTag, 'media-type');
			if (mediaType !== 'application/x-dtbncx+xml') {
				continue;
			}

			ncxHref = getXmlAttribute(itemTag, 'href');
			break;
		}
	}

	if (!ncxHref) {
		return null;
	}

	return path.posix.normalize(opfDir === '.' ? ncxHref : path.posix.join(opfDir, ncxHref));
}

function escapeXmlText(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

export class EpubMetadataService {
	async rewriteTitle(epubBuffer: Buffer, title: string): Promise<ApiResult<Buffer>> {
		const normalizedTitle = title.trim();
		if (!normalizedTitle) {
			return apiError('Cannot rewrite EPUB title: title is empty', 400);
		}

		try {
			const zip = await JSZip.loadAsync(epubBuffer);

			const mimetypeEntry = zip.file(MIMETYPE_PATH);
			if (!mimetypeEntry) {
				return apiError('Cannot rewrite EPUB title: missing mimetype file', 422);
			}
			const mimetypeValue = (await mimetypeEntry.async('string')).trim();
			if (mimetypeValue !== EPUB_MIMETYPE) {
				return apiError('Cannot rewrite EPUB title: invalid mimetype value', 422);
			}

			const containerEntry = zip.file(CONTAINER_PATH);
			if (!containerEntry) {
				return apiError('Cannot rewrite EPUB title: missing META-INF/container.xml', 422);
			}

			const containerXml = await containerEntry.async('string');
			const rootfileMatch = containerXml.match(ROOTFILE_PATH_REGEX);
			const opfPath = rootfileMatch?.[2];
			if (!opfPath) {
				return apiError('Cannot rewrite EPUB title: OPF path not found in container.xml', 422);
			}

			const opfEntry = zip.file(opfPath);
			if (!opfEntry) {
				return apiError(`Cannot rewrite EPUB title: OPF not found at ${opfPath}`, 422);
			}

			const opfXml = await opfEntry.async('string');
			if (!DC_TITLE_REGEX.test(opfXml)) {
				return apiError('Cannot rewrite EPUB title: <dc:title> not found in OPF', 422);
			}

			const escapedTitle = escapeXmlText(normalizedTitle);
			const updatedOpfXml = opfXml.replace(DC_TITLE_REGEX, `<dc:title$1>${escapedTitle}</dc:title>`);
			const ncxPath = resolveNcxPathFromOpf(opfXml, opfPath);
			let updatedNcxXml: string | null = null;

			if (ncxPath) {
				const ncxEntry = zip.file(ncxPath);
				if (ncxEntry) {
					const ncxXml = await ncxEntry.async('string');
					if (DOC_TITLE_TEXT_REGEX.test(ncxXml)) {
						updatedNcxXml = ncxXml.replace(
							DOC_TITLE_TEXT_REGEX,
							`$1${escapedTitle}$2`
						);
					}
				}
			}
			
			// Rebuild EPUB in spec-compliant order:
			// 1) uncompressed mimetype as first entry
			// 2) all other entries, with OPF/NCX content replaced
			const rebuiltZip = new JSZip();
			rebuiltZip.file(MIMETYPE_PATH, EPUB_MIMETYPE, { compression: 'STORE' });

			for (const [entryName, entry] of Object.entries(zip.files)) {
				if (entry.dir || entryName === MIMETYPE_PATH) {
					continue;
				}

				if (entryName === opfPath) {
					rebuiltZip.file(entryName, updatedOpfXml);
					continue;
				}

				if (updatedNcxXml && ncxPath && entryName === ncxPath) {
					rebuiltZip.file(entryName, updatedNcxXml);
					continue;
				}

				const bytes = await entry.async('uint8array');
				rebuiltZip.file(entryName, bytes);
			}

			const rebuiltEpub = await rebuiltZip.generateAsync({
				type: 'nodebuffer',
				compression: 'DEFLATE',
				streamFiles: false
			});

			return apiOk(rebuiltEpub);
		} catch (cause) {
			return apiError('Cannot rewrite EPUB title: invalid EPUB archive', 422, cause);
		}
	}
}
