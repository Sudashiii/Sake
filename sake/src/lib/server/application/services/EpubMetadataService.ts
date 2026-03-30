import JSZip from 'jszip';
import path from 'node:path';
import { MAX_MANAGED_BOOK_COVER_BYTES } from '$lib/server/application/services/ManagedBookCoverService';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import { parsePublicationDateString } from '$lib/utils/publicationDate';

const CONTAINER_PATH = 'META-INF/container.xml';
const MIMETYPE_PATH = 'mimetype';
const EPUB_MIMETYPE = 'application/epub+zip';
const ROOTFILE_PATH_REGEX = /<rootfile\b[^>]*\bfull-path\s*=\s*(["'])([^"']+)\1/i;
const DC_TITLE_REGEX = /<dc:title\b([^>]*)>[\s\S]*?<\/dc:title>/i;
const SPINE_TOC_ID_REGEX = /<spine\b[^>]*\btoc\s*=\s*(["'])([^"']+)\1/i;
const ITEM_TAG_REGEX = /<item\b[^>]*>/gi;
const META_TAG_REGEX = /<meta\b[^>]*>/gi;
const GUIDE_REFERENCE_TAG_REGEX = /<reference\b[^>]*>/gi;
const DOC_TITLE_TEXT_REGEX =
	/(<docTitle\b[^>]*>[\s\S]*?<text\b[^>]*>)[\s\S]*?(<\/text>[\s\S]*?<\/docTitle>)/i;
const IMG_TAG_SRC_REGEX = /<img\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1/i;
const XML_TAG_PREFIX_REGEX = '(?:[A-Za-z_][\\w.-]*:)?';
const BASIC_XML_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'"
};

interface LoadedEpubPackage {
	zip: JSZip;
	opfPath: string;
	opfXml: string;
	ncxPath: string | null;
}

interface ManifestItem {
	id: string | null;
	href: string | null;
	mediaType: string | null;
	properties: string | null;
	resolvedPath: string | null;
}

export interface ExtractedUploadMetadata {
	title: string | null;
	author: string | null;
	publisher: string | null;
	identifier: string | null;
	description: string | null;
	language: string | null;
	year: number | null;
	month: number | null;
	day: number | null;
}

export interface ExtractedUploadCover {
	data: Buffer;
	contentType: string;
}

export interface ExtractedEpubUploadData {
	metadata: ExtractedUploadMetadata | null;
	cover: ExtractedUploadCover | null;
}

type ZipEntryWithSizeHint = JSZip.JSZipObject & {
	_data?: {
		uncompressedSize?: unknown;
	};
};

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

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXmlText(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function decodeNumericEntity(value: string, radix: number): string {
	const parsed = Number.parseInt(value, radix);
	if (!Number.isFinite(parsed)) {
		return '';
	}

	try {
		return String.fromCodePoint(parsed);
	} catch {
		return '';
	}
}

function decodeXmlText(value: string): string {
	return value
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => decodeNumericEntity(hex, 16))
		.replace(/&#([0-9]+);/g, (_, decimal: string) => decodeNumericEntity(decimal, 10))
		.replace(
			/&([a-z]+);/gi,
			(match: string, entityName: string) => BASIC_XML_ENTITIES[entityName.toLowerCase()] ?? match
		);
}

function normalizeMetadataText(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const normalized = decodeXmlText(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
	return normalized.length > 0 ? normalized : null;
}

function buildXmlTagRegex(localName: string): RegExp {
	const escapedLocalName = escapeRegExp(localName);
	return new RegExp(
		`<${XML_TAG_PREFIX_REGEX}${escapedLocalName}\\b[^>]*>([\\s\\S]*?)<\\/${XML_TAG_PREFIX_REGEX}${escapedLocalName}>`,
		'gi'
	);
}

function extractTagValues(xml: string, localName: string): string[] {
	const values: string[] = [];

	for (const match of xml.matchAll(buildXmlTagRegex(localName))) {
		const normalized = normalizeMetadataText(match[1]);
		if (normalized) {
			values.push(normalized);
		}
	}

	return values;
}

function extractFirstTagValue(xml: string, localName: string): string | null {
	return extractTagValues(xml, localName)[0] ?? null;
}

function normalizeIdentifier(value: string): string | null {
	const normalized = value.replace(/[^0-9Xx]/g, '').toUpperCase();
	return /^(97[89])?\d{9}[\dX]$/.test(normalized) ? normalized : null;
}

function pickIdentifier(xml: string): string | null {
	const identifiers = extractTagValues(xml, 'identifier');
	for (const identifier of identifiers) {
		const normalizedIsbn = normalizeIdentifier(identifier);
		if (normalizedIsbn) {
			return normalizedIsbn;
		}
	}

	return identifiers[0] ?? null;
}

function pickAuthor(xml: string): string | null {
	const creators = [...new Set(extractTagValues(xml, 'creator'))];
	return creators.length > 0 ? creators.join(', ') : null;
}

function pickPublicationDate(xml: string): { year: number | null; month: number | null; day: number | null } {
	for (const dateValue of extractTagValues(xml, 'date')) {
		const parsed = parsePublicationDateString(dateValue);
		if (parsed) {
			return parsed;
		}
	}

	return {
		year: null,
		month: null,
		day: null
	};
}

function normalizeLanguage(value: string | null): string | null {
	if (!value) {
		return null;
	}

	const normalized = value.replace(/_/g, '-').trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
}

function hasExtractedMetadata(metadata: ExtractedUploadMetadata): boolean {
	return Object.values(metadata).some((value) => value !== null);
}

function normalizeContentType(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const normalized = value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
	return normalized.length > 0 ? normalized : null;
}

function normalizeArchiveHref(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const normalized = value.trim();
	if (!normalized) {
		return null;
	}

	const [withoutFragment] = normalized.split('#', 1);
	const [withoutQuery] = (withoutFragment ?? normalized).split('?', 1);
	const archivePath = withoutQuery?.trim() ?? '';
	return archivePath.length > 0 ? archivePath : null;
}

function resolveArchivePath(basePath: string, href: string | null | undefined): string | null {
	const normalizedHref = normalizeArchiveHref(href);
	if (!normalizedHref) {
		return null;
	}

	const baseDir = path.posix.dirname(basePath);
	return path.posix.normalize(
		baseDir === '.' ? normalizedHref : path.posix.join(baseDir, normalizedHref)
	);
}

function parseManifestItems(opfXml: string, opfPath: string): ManifestItem[] {
	return (opfXml.match(ITEM_TAG_REGEX) ?? []).map((itemTag) => {
		const href = getXmlAttribute(itemTag, 'href');
		return {
			id: getXmlAttribute(itemTag, 'id'),
			href,
			mediaType: normalizeContentType(getXmlAttribute(itemTag, 'media-type')),
			properties: getXmlAttribute(itemTag, 'properties'),
			resolvedPath: resolveArchivePath(opfPath, href)
		};
	});
}

function isImageContentType(value: string | null | undefined): value is string {
	return typeof value === 'string' && value.startsWith('image/');
}

function isHtmlContentType(value: string | null | undefined): boolean {
	return value === 'application/xhtml+xml' || value === 'text/html';
}

function hasCoverImageProperty(value: string | null | undefined): boolean {
	if (typeof value !== 'string') {
		return false;
	}

	return value
		.split(/\s+/)
		.map((token) => token.trim().toLowerCase())
		.includes('cover-image');
}

function inferImageContentTypeFromPath(filePath: string | null | undefined): string | null {
	const extension = path.posix.extname(filePath ?? '').toLowerCase();
	switch (extension) {
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.png':
			return 'image/png';
		case '.gif':
			return 'image/gif';
		case '.webp':
			return 'image/webp';
		case '.avif':
			return 'image/avif';
		default:
			return null;
	}
}

function resolveImageManifestItem(item: ManifestItem | undefined): {
	path: string;
	contentType: string;
} | null {
	if (!item?.resolvedPath) {
		return null;
	}

	const contentType = item.mediaType ?? inferImageContentTypeFromPath(item.resolvedPath);
	if (!isImageContentType(contentType)) {
		return null;
	}

	return {
		path: item.resolvedPath,
		contentType
	};
}

function getZipEntryUncompressedSize(entry: JSZip.JSZipObject): number | null {
	const sizeHint = (entry as ZipEntryWithSizeHint)._data?.uncompressedSize;
	return typeof sizeHint === 'number' && Number.isFinite(sizeHint) && sizeHint >= 0
		? sizeHint
		: null;
}

export class EpubMetadataService {
	private readonly serviceLogger = createChildLogger({ service: 'EpubMetadataService' });

	async rewriteTitle(epubBuffer: Buffer, title: string): Promise<ApiResult<Buffer>> {
		const normalizedTitle = title.trim();
		if (!normalizedTitle) {
			return apiError('Cannot rewrite EPUB title: title is empty', 400);
		}

		try {
			const packageResult = await this.loadPackage(epubBuffer, 'Cannot rewrite EPUB title');
			if (!packageResult.ok) {
				return packageResult;
			}

			const { zip, opfPath, opfXml, ncxPath } = packageResult.value;
			if (!DC_TITLE_REGEX.test(opfXml)) {
				return apiError('Cannot rewrite EPUB title: <dc:title> not found in OPF', 422);
			}

			const escapedTitle = escapeXmlText(normalizedTitle);
			const updatedOpfXml = opfXml.replace(DC_TITLE_REGEX, `<dc:title$1>${escapedTitle}</dc:title>`);
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

	async extractMetadata(epubBuffer: Buffer): Promise<ExtractedUploadMetadata | null> {
		const uploadData = await this.extractUploadData(epubBuffer);
		return uploadData.metadata;
	}

	async extractUploadData(epubBuffer: Buffer): Promise<ExtractedEpubUploadData> {
		const packageResult = await this.loadPackage(epubBuffer, 'Cannot extract EPUB metadata');
		if (!packageResult.ok) {
			this.serviceLogger.warn(
				{
					event: 'epub.metadata.extract.skipped',
					reason: packageResult.error.message
				},
				'EPUB metadata extraction skipped'
			);
			return { metadata: null, cover: null };
		}

		const { opfXml } = packageResult.value;
		const publicationDate = pickPublicationDate(opfXml);
		const metadata: ExtractedUploadMetadata = {
			title: extractFirstTagValue(opfXml, 'title'),
			author: pickAuthor(opfXml),
			publisher: extractFirstTagValue(opfXml, 'publisher'),
			identifier: pickIdentifier(opfXml),
			description: extractFirstTagValue(opfXml, 'description'),
			language: normalizeLanguage(extractFirstTagValue(opfXml, 'language')),
			year: publicationDate.year,
			month: publicationDate.month,
			day: publicationDate.day
		};

		return {
			metadata: hasExtractedMetadata(metadata) ? metadata : null,
			cover: await this.extractCover(packageResult.value)
		};
	}

	private async loadPackage(
		epubBuffer: Buffer,
		failurePrefix: string
	): Promise<ApiResult<LoadedEpubPackage>> {
		try {
			const zip = await JSZip.loadAsync(epubBuffer);
			const mimetypeEntry = zip.file(MIMETYPE_PATH);
			if (!mimetypeEntry) {
				return apiError(`${failurePrefix}: missing mimetype file`, 422);
			}

			const mimetypeValue = (await mimetypeEntry.async('string')).trim();
			if (mimetypeValue !== EPUB_MIMETYPE) {
				return apiError(`${failurePrefix}: invalid mimetype value`, 422);
			}

			const containerEntry = zip.file(CONTAINER_PATH);
			if (!containerEntry) {
				return apiError(`${failurePrefix}: missing META-INF/container.xml`, 422);
			}

			const containerXml = await containerEntry.async('string');
			const rootfileMatch = containerXml.match(ROOTFILE_PATH_REGEX);
			const opfPath = rootfileMatch?.[2];
			if (!opfPath) {
				return apiError(`${failurePrefix}: OPF path not found in container.xml`, 422);
			}

			const opfEntry = zip.file(opfPath);
			if (!opfEntry) {
				return apiError(`${failurePrefix}: OPF not found at ${opfPath}`, 422);
			}

			const opfXml = await opfEntry.async('string');
			const ncxPath = resolveNcxPathFromOpf(opfXml, opfPath);

			return apiOk({
				zip,
				opfPath,
				opfXml,
				ncxPath
			});
		} catch (cause) {
			return apiError(`${failurePrefix}: invalid EPUB archive`, 422, cause);
		}
	}

	private async extractCover(epubPackage: LoadedEpubPackage): Promise<ExtractedUploadCover | null> {
		const coverReference = await this.resolveCoverReference(epubPackage);
		if (coverReference === null) {
			return null;
		}

		const entry = epubPackage.zip.file(coverReference.path);
		if (!entry) {
			return null;
		}

		const uncompressedSize = getZipEntryUncompressedSize(entry);
		if (uncompressedSize !== null && uncompressedSize > MAX_MANAGED_BOOK_COVER_BYTES) {
			return null;
		}

		try {
			const data = Buffer.from(await entry.async('uint8array'));
			if (
				data.byteLength === 0 ||
				data.byteLength > MAX_MANAGED_BOOK_COVER_BYTES
			) {
				return null;
			}

			return {
				data,
				contentType: coverReference.contentType
			};
		} catch {
			return null;
		}
	}

	private async resolveCoverReference(epubPackage: LoadedEpubPackage): Promise<{
		path: string;
		contentType: string;
	} | null> {
		const manifestItems = parseManifestItems(epubPackage.opfXml, epubPackage.opfPath);
		return (
			this.resolveCoverFromMetadata(epubPackage.opfXml, manifestItems) ??
			this.resolveCoverFromManifestProperties(manifestItems) ??
			(await this.resolveCoverFromGuide(epubPackage, manifestItems)) ??
			this.resolveCoverFromManifestName(manifestItems)
		);
	}

	private resolveCoverFromMetadata(
		opfXml: string,
		manifestItems: ManifestItem[]
	): { path: string; contentType: string } | null {
		for (const metaTag of opfXml.match(META_TAG_REGEX) ?? []) {
			if (getXmlAttribute(metaTag, 'name')?.trim().toLowerCase() !== 'cover') {
				continue;
			}

			const coverId = getXmlAttribute(metaTag, 'content')?.trim();
			if (!coverId) {
				continue;
			}

			const manifestItem = manifestItems.find((item) => item.id === coverId);
			const resolved = resolveImageManifestItem(manifestItem);
			if (resolved) {
				return resolved;
			}
		}

		return null;
	}

	private resolveCoverFromManifestProperties(
		manifestItems: ManifestItem[]
	): { path: string; contentType: string } | null {
		for (const item of manifestItems) {
			if (!hasCoverImageProperty(item.properties)) {
				continue;
			}

			const resolved = resolveImageManifestItem(item);
			if (resolved) {
				return resolved;
			}
		}

		return null;
	}

	private async resolveCoverFromGuide(
		epubPackage: LoadedEpubPackage,
		manifestItems: ManifestItem[]
	): Promise<{ path: string; contentType: string } | null> {
		for (const referenceTag of epubPackage.opfXml.match(GUIDE_REFERENCE_TAG_REGEX) ?? []) {
			if (getXmlAttribute(referenceTag, 'type')?.trim().toLowerCase() !== 'cover') {
				continue;
			}

			const referencePath = resolveArchivePath(
				epubPackage.opfPath,
				getXmlAttribute(referenceTag, 'href')
			);
			if (!referencePath) {
				continue;
			}

			const manifestItem = manifestItems.find((item) => item.resolvedPath === referencePath);
			const directImage = resolveImageManifestItem(manifestItem);
			if (directImage) {
				return directImage;
			}

			const directContentType =
				manifestItem?.mediaType ?? inferImageContentTypeFromPath(referencePath);
			if (isImageContentType(directContentType) && epubPackage.zip.file(referencePath)) {
				return {
					path: referencePath,
					contentType: directContentType
				};
			}

			if (manifestItem && !isHtmlContentType(manifestItem.mediaType)) {
				continue;
			}

			const nestedImage = await this.resolveImageFromDocumentReference(
				epubPackage,
				manifestItems,
				referencePath
			);
			if (nestedImage) {
				return nestedImage;
			}
		}

		return null;
	}

	private async resolveImageFromDocumentReference(
		epubPackage: LoadedEpubPackage,
		manifestItems: ManifestItem[],
		documentPath: string
	): Promise<{ path: string; contentType: string } | null> {
		const entry = epubPackage.zip.file(documentPath);
		if (!entry) {
			return null;
		}

		try {
			const documentXml = await entry.async('string');
			const imageHref = normalizeArchiveHref(documentXml.match(IMG_TAG_SRC_REGEX)?.[2] ?? null);
			if (!imageHref) {
				return null;
			}

			const imagePath = resolveArchivePath(documentPath, imageHref);
			if (!imagePath) {
				return null;
			}

			const manifestItem = manifestItems.find((item) => item.resolvedPath === imagePath);
			const directImage = resolveImageManifestItem(manifestItem);
			if (directImage) {
				return directImage;
			}

			const contentType =
				manifestItem?.mediaType ?? inferImageContentTypeFromPath(imagePath);
			if (!isImageContentType(contentType) || !epubPackage.zip.file(imagePath)) {
				return null;
			}

			return {
				path: imagePath,
				contentType
			};
		} catch {
			return null;
		}
	}

	private resolveCoverFromManifestName(
		manifestItems: ManifestItem[]
	): { path: string; contentType: string } | null {
		for (const item of manifestItems) {
			const marker = `${item.id ?? ''} ${item.href ?? ''}`.toLowerCase();
			if (!marker.includes('cover')) {
				continue;
			}

			const resolved = resolveImageManifestItem(item);
			if (resolved) {
				return resolved;
			}
		}

		return null;
	}
}
