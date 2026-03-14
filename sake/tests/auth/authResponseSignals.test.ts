import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	SAKE_CLEAR_SESSION_HEADER_NAME,
	SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME,
	ZLIBRARY_AUTH_CLEARED_EVENT_NAME,
	ZLIBRARY_NAME_STORAGE_KEY
} from '$lib/auth/responseSignals';
import { applyAuthResponseSignals } from '$lib/client/base/authResponseSignals';

describe('applyAuthResponseSignals', () => {
	test('clears stored Z-Library auth markers and dispatches an event', () => {
		const removedKeys: string[] = [];
		const dispatchedEvents: string[] = [];
		const response = {
			headers: new Headers([[SAKE_CLEAR_ZLIBRARY_AUTH_HEADER_NAME, 'true']])
		};

		applyAuthResponseSignals(response, {
			pathname: '/search',
			appRootPath: '/',
			replace: () => assert.fail('session redirect should not run'),
			removeItem: (key) => removedKeys.push(key),
			dispatchEvent: (event) => dispatchedEvents.push(event.type),
			createEvent: (type) => new Event(type)
		});

		assert.deepEqual(removedKeys, [ZLIBRARY_NAME_STORAGE_KEY]);
		assert.deepEqual(dispatchedEvents, [ZLIBRARY_AUTH_CLEARED_EVENT_NAME]);
	});

	test('redirects to root when the server marks the session as stale', () => {
		let replacedHref = '';
		const response = {
			headers: new Headers([[SAKE_CLEAR_SESSION_HEADER_NAME, 'true']])
		};

		applyAuthResponseSignals(response, {
			pathname: '/library',
			appRootPath: '/',
			replace: (href) => {
				replacedHref = href;
			},
			removeItem: () => assert.fail('zlibrary cleanup should not run'),
			dispatchEvent: () => assert.fail('zlibrary cleanup should not run'),
			createEvent: (type) => new Event(type)
		});

		assert.equal(replacedHref, '/');
	});

	test('does not redirect again when already on the login page', () => {
		let redirected = false;
		const response = {
			headers: new Headers([[SAKE_CLEAR_SESSION_HEADER_NAME, 'true']])
		};

		applyAuthResponseSignals(response, {
			pathname: '/',
			appRootPath: '/',
			replace: () => {
				redirected = true;
			},
			removeItem: () => assert.fail('zlibrary cleanup should not run'),
			dispatchEvent: () => assert.fail('zlibrary cleanup should not run'),
			createEvent: (type) => new Event(type)
		});

		assert.equal(redirected, false);
	});

	test('redirects to the configured app root when mounted under a base path', () => {
		let replacedHref = '';
		const response = {
			headers: new Headers([[SAKE_CLEAR_SESSION_HEADER_NAME, 'true']])
		};

		applyAuthResponseSignals(response, {
			pathname: '/sake/library',
			appRootPath: '/sake/',
			replace: (href) => {
				replacedHref = href;
			},
			removeItem: () => assert.fail('zlibrary cleanup should not run'),
			dispatchEvent: () => assert.fail('zlibrary cleanup should not run'),
			createEvent: (type) => new Event(type)
		});

		assert.equal(replacedHref, '/sake/');
	});
});
