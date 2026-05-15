import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sanitizeMetadataDescription } from '$lib/server/application/services/MetadataDescriptionSanitizer';
import { normalizeAuthor, normalizeAuthorForMatch } from '$lib/utils/author';

describe('metadata safety helpers', () => {
	test('sanitizes HTML descriptions with a strict allowlist', () => {
		const sanitized = sanitizeMetadataDescription(
			`<p class="lead">Hello <strong onclick="x()">world</strong><script>alert(1)</script><a href="https://example.com">link</a><br data-x="1"><img src=x onerror=x></p>`,
			'html'
		);

		assert.equal(sanitized, '<p>Hello <strong>world</strong>link<br></p>');
	});

	test('keeps text and markdown descriptions as trimmed text', () => {
		assert.equal(sanitizeMetadataDescription('  **Hello**  ', 'markdown'), '**Hello**');
		assert.equal(sanitizeMetadataDescription('  plain text  ', 'text'), 'plain text');
		assert.equal(sanitizeMetadataDescription('   ', 'html'), null);
	});

	test('normalizes author strings for display and matching', () => {
		assert.equal(normalizeAuthor('  Frank   Herbert  '), 'Frank Herbert');
		assert.equal(normalizeAuthor('   '), null);
		assert.equal(normalizeAuthorForMatch('Frank  Herbert, Jr.'), 'frank herbert jr');
	});
});
