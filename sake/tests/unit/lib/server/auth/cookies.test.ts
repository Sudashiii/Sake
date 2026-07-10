import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Cookies } from '@sveltejs/kit';
import { setSakeSessionCookie } from '$lib/server/auth/cookies';

function createCookieRecorder() {
	const sets: Array<{
		name: string;
		value: string;
		options: Record<string, unknown>;
	}> = [];

	const cookies = {
		get() {
			return undefined;
		},
		getAll() {
			return [];
		},
		set(name: string, value: string, options: Record<string, unknown>) {
			sets.push({ name, value, options });
		},
		delete() {},
		serialize() {
			return '';
		}
	} as unknown as Cookies;

	return { cookies, sets };
}

describe('setSakeSessionCookie', () => {
	test('does not mark cookies as secure for direct HTTP adapter-node requests', () => {
		const { cookies, sets } = createCookieRecorder();

		setSakeSessionCookie(
			cookies,
			{
				url: new URL('https://127.0.0.1:4174/api/auth/bootstrap'),
				request: new Request('https://127.0.0.1:4174/api/auth/bootstrap'),
				platform: {
					req: {
						socket: {}
					}
				}
			},
			'test-token',
			'2026-05-19T11:38:25.149Z'
		);

		assert.equal(sets.length, 1);
		assert.equal(sets[0]?.name, 'sake_session');
		assert.equal(sets[0]?.options.secure, false);
	});

	test('keeps cookies secure when a proxy reports https', () => {
		const { cookies, sets } = createCookieRecorder();

		setSakeSessionCookie(
			cookies,
			{
				url: new URL('https://sake.example/api/auth/login'),
				request: new Request('https://sake.example/api/auth/login', {
					headers: {
						'x-forwarded-proto': 'https'
					}
				}),
				platform: {
					req: {
						socket: {
							encrypted: false
						}
					}
				}
			},
			'test-token',
			'2026-05-19T11:38:25.149Z'
		);

		assert.equal(sets.length, 1);
		assert.equal(sets[0]?.options.secure, true);
	});

	test('falls back to the request URL when transport hints are unavailable', () => {
		const { cookies, sets } = createCookieRecorder();

		setSakeSessionCookie(
			cookies,
			{
				url: new URL('http://localhost:5173/api/auth/login'),
				request: new Request('http://localhost:5173/api/auth/login')
			},
			'test-token',
			'2026-05-19T11:38:25.149Z'
		);

		assert.equal(sets.length, 1);
		assert.equal(sets[0]?.options.secure, false);
	});
});
