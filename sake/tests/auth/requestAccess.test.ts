import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isApiKeyAllowedRoute, isPublicApiRoute } from '$lib/server/auth/requestAccess';

describe('requestAccess', () => {
	test('allows API keys to fetch managed library covers', () => {
		assert.equal(isApiKeyAllowedRoute('/api/library/covers/example.epub.jpg', 'GET'), true);
	});

	test('still blocks non-GET access to managed library covers', () => {
		assert.equal(isApiKeyAllowedRoute('/api/library/covers/example.epub.jpg', 'POST'), false);
	});

	test('allows API keys to export existing device library books', () => {
		assert.equal(isApiKeyAllowedRoute('/api/library/export', 'POST'), true);
	});

	test('allows API keys to post device logs', () => {
		assert.equal(isApiKeyAllowedRoute('/api/devices/logs', 'POST'), true);
	});

	test('does not expose the export route as a direct library file GET', () => {
		assert.equal(isApiKeyAllowedRoute('/api/library/export', 'GET'), false);
	});

	test('keeps the webapp logs stream session-only', () => {
		assert.equal(isPublicApiRoute('/api/logs/webapp/stream', 'GET'), false);
		assert.equal(isApiKeyAllowedRoute('/api/logs/webapp/stream', 'GET'), false);
	});

	test('keeps the device logs stream session-only', () => {
		assert.equal(isPublicApiRoute('/api/devices/device-a/logs/stream', 'GET'), false);
		assert.equal(isApiKeyAllowedRoute('/api/devices/device-a/logs/stream', 'GET'), false);
	});

	test('keeps KOReader plugin latest and default download endpoints compatible for older devices', () => {
		assert.equal(isPublicApiRoute('/api/plugin/koreader/latest', 'GET'), true);
		assert.equal(isApiKeyAllowedRoute('/api/plugin/koreader/latest', 'GET'), true);
		assert.equal(isPublicApiRoute('/api/plugin/koreader/download', 'GET'), true);
		assert.equal(isApiKeyAllowedRoute('/api/plugin/koreader/download', 'GET'), true);
	});

	test('exposes the additive plugin releases endpoint without changing old auth behavior', () => {
		assert.equal(isPublicApiRoute('/api/plugin/koreader/releases', 'GET'), true);
		assert.equal(isApiKeyAllowedRoute('/api/plugin/koreader/releases', 'GET'), true);
		assert.equal(isPublicApiRoute('/api/plugin/koreader/releases', 'POST'), false);
		assert.equal(isApiKeyAllowedRoute('/api/plugin/koreader/releases', 'POST'), false);
	});
});
