import type { MetadataCandidate } from '$lib/server/application/ports/MetadataProviderPort';

const ALLOWED_HTML_TAGS = new Set(['p', 'br', 'em', 'strong', 'i', 'b']);
const DANGEROUS_HTML_BLOCK_REGEX =
	/<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_VOID_TAG_REGEX =
	/<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*(?:\/\s*)?>/gi;
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;
const HTML_TAG_REGEX = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9:-]*)(?:\s[^>]*)?\s*(\/?)\s*>/g;

export function sanitizeMetadataDescription(
	description: string | null | undefined,
	format: MetadataCandidate['descriptionFormat']
): string | null {
	if (typeof description !== 'string') {
		return null;
	}

	const trimmed = description.trim();
	if (!trimmed) {
		return null;
	}

	if (format !== 'html') {
		return trimmed;
	}

	const sanitized = trimmed
		.replace(HTML_COMMENT_REGEX, '')
		.replace(DANGEROUS_HTML_BLOCK_REGEX, '')
		.replace(DANGEROUS_VOID_TAG_REGEX, '')
		.replace(HTML_TAG_REGEX, (_match, closing: string, tagName: string) => {
			const tag = tagName.toLowerCase();
			if (!ALLOWED_HTML_TAGS.has(tag)) {
				return '';
			}
			if (tag === 'br') {
				return '<br>';
			}
			return closing ? `</${tag}>` : `<${tag}>`;
		})
		.trim();

	return sanitized.length > 0 ? sanitized : null;
}
