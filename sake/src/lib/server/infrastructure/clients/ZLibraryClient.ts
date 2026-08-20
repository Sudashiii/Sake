import type { ZBookFileResponse } from '$lib/types/ZLibrary/Responses/ZBookFileResponse';
import type { ZSearchBookResponse } from '$lib/types/ZLibrary/Responses/ZSearchBookResponse';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';
import type { ZLibraryCredentials, ZLibraryPort, ZLibrarySearchRequest } from '$lib/server/application/ports/ZLibraryPort';
import { toUrlEncoded } from '$lib/server/infrastructure/clients/toUrlEncode';
import type { ZLoginRequest } from '$lib/types/ZLibrary/Requests/ZLoginRequest';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import {
	ExternalClientError,
	parseExternalJson,
	requestExternal
} from '$lib/server/infrastructure/clients/externalClientPolicy';

export class ZLibraryClient implements ZLibraryPort {
	private readonly getBaseUrls: () => Promise<readonly string[]>;

	constructor(baseUrl: string | (() => Promise<readonly string[]>), private readonly fetchFn: typeof fetch = fetch) {
		this.getBaseUrls = typeof baseUrl === 'string' ? async () => [baseUrl] : baseUrl;
	}

	async search(searchBookRequest: ZLibrarySearchRequest): Promise<ApiResult<ZSearchBookResponse>> {
		const body: Record<string, unknown> = {};
		const { searchText, yearFrom, yearTo, languages, extensions, order, limit } = searchBookRequest;

		if (searchText) body.message = searchText;
		if (yearFrom) body.yearFrom = yearFrom;
		if (yearTo) body.yearTo = yearTo;
		if (languages?.length) body.languages = languages;
		if (extensions?.length) body.extensions = extensions;
		if (order) body.order = order;
		if (limit !== undefined) body.limit = limit;

		return this.post<ZSearchBookResponse>(ZLibraryRoutes.search, body);
	}

	async download(
		bookId: string,
		hash: string,
		credentials: ZLibraryCredentials
	): Promise<ApiResult<Response>> {
		const fileInfoResponse = await this.get(`/eapi/book/${bookId}/${hash}/file`, credentials);
		if (!fileInfoResponse.ok) {
			return fileInfoResponse;
		}

		let fileInfo: ZBookFileResponse;
		try {
			fileInfo = await parseExternalJson(fileInfoResponse.value, isZBookFileResponse);
		} catch (cause) {
			return apiError('Failed to parse download file info', 502, cause);
		}

		return this.getAbsolute(fileInfo.file.downloadLink, credentials);
	}

	async signup(_email: string, _name: string, _password: string): Promise<ApiResult<boolean>> {
		return apiError('Method not implemented', 501);
	}

	async passwordLogin(name: string, password: string): Promise<ApiResult<ZLoginResponse>> {
		const request: ZLoginRequest = { email: name, password };
		return this.post<ZLoginResponse>(ZLibraryRoutes.passwordLogin, request);
	}

	async tokenLogin(id: string, token: string): Promise<ApiResult<void>> {
		const profileResponse = await this.get(ZLibraryRoutes.profile, { userId: id, userKey: token });
		if (!profileResponse.ok) {
			return profileResponse;
		}

		if (profileResponse.value.status !== 200) {
			return apiError('Z-Library login failed', 401);
		}

		return apiOk(undefined);
	}

	private getCookies(credentials: ZLibraryCredentials): string {
		const cookies = {
			siteLanguageV2: 'en',
			remix_userid: credentials.userId,
			remix_userkey: credentials.userKey
		};

		return Object.entries(cookies)
			.map(([k, v]) => `${k}=${v}`)
			.join('; ');
	}

	private getHeaders(credentials?: ZLibraryCredentials): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/x-www-form-urlencoded',
			accept:
				'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
			'accept-language': 'en-US,en;q=0.9',
			'user-agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
		};

		if (credentials) {
			headers.Cookie = this.getCookies(credentials);
		}

		return headers;
	}

	private async get(path: string, credentials?: ZLibraryCredentials): Promise<ApiResult<Response>> {
		return this.tryMirrors(async (baseUrl) => {
			try {
				const response = await this.request(baseUrl + path, {
					method: 'GET',
					headers: this.getHeaders(credentials)
				});

				if (!response.ok) {
					return apiError(`Request failed with status ${response.status}`, getUpstreamErrorStatus(response.status));
				}

				return apiOk(response);
			} catch (cause) {
				return apiError('Failed to execute GET request', getExternalStatus(cause), cause);
			}
		});
	}

	private async getAbsolute(url: string, credentials?: ZLibraryCredentials): Promise<ApiResult<Response>> {
		try {
			const response = await this.request(url, {
				method: 'GET',
				headers: this.getHeaders(credentials)
			});

			if (!response.ok) {
				return apiError(`Request failed with status ${response.status}`, getUpstreamErrorStatus(response.status));
			}

			return apiOk(response);
		} catch (cause) {
			return apiError('Failed to execute GET request', getExternalStatus(cause), cause);
		}
	}

	private async post<T>(
		path: string,
		data: object,
		credentials?: ZLibraryCredentials
	): Promise<ApiResult<T>> {
		return this.tryMirrors(async (baseUrl) => {
			try {
				const response = await this.request(baseUrl + path, {
					method: 'POST',
					headers: this.getHeaders(credentials),
					body: toUrlEncoded(data)
				});
				if (!response.ok) {
					return apiError(`Request failed with status ${response.status}`, getUpstreamErrorStatus(response.status));
				}

				const parsed = await parseExternalJson(response, (value): value is T => {
					if (path === ZLibraryRoutes.search) return isZSearchBookResponse(value);
					if (path === ZLibraryRoutes.passwordLogin) return isZLoginResponse(value);
					return typeof value === 'object' && value !== null;
				});
				return apiOk(parsed);
			} catch (cause) {
				return apiError('Failed to execute POST request', getExternalStatus(cause), cause);
			}
		});
	}

	private async tryMirrors<T>(request: (baseUrl: string) => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
		let urls: readonly string[];
		try {
			urls = await this.getBaseUrls();
		} catch (cause) {
			return apiError('Failed to load Z-Library mirror configuration', 500, cause);
		}

		let lastFailure: ApiResult<T> | null = null;
		for (const url of urls) {
			const result = await request(url);
			if (result.ok || !shouldTryNextMirror(result.error)) return result;
			lastFailure = result;
		}
		return lastFailure ?? apiError('No Z-Library mirrors are configured', 503);
	}

	private async request(url: string, init: RequestInit): Promise<Response> {
		const response = await requestExternal(this.fetchFn, url, {
			...init,
			timeoutMs: 30_000,
			redirect: 'manual',
			allowManualRedirect: true
		});

		const challengeCookie = getChallengeCookie(response.headers.get('set-cookie'));
		if (!isSelfRedirect(response, url) || challengeCookie === null) {
			return response;
		}

		const headers = new Headers(init.headers);
		const existingCookie = headers.get('Cookie');
		headers.set('Cookie', existingCookie ? `${existingCookie}; ${challengeCookie}` : challengeCookie);

		return requestExternal(this.fetchFn, url, {
			...init,
			timeoutMs: 30_000,
			headers
		});
	}
}

function getExternalStatus(cause: unknown): number {
	return cause instanceof ExternalClientError ? getUpstreamErrorStatus(cause.status) : 502;
}

function shouldTryNextMirror(error: { status: number; cause?: unknown }): boolean {
	if (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 422) {
		return false;
	}
	return error.cause instanceof ExternalClientError ? error.cause.isRetryable : error.status >= 500;
}

function getUpstreamErrorStatus(status: number): number {
	return status >= 400 ? status : 502;
}

function getChallengeCookie(setCookie: string | null): string | null {
	if (!setCookie) {
		return null;
	}

	const cookie = setCookie.split(';', 1)[0]?.trim();
	return cookie && cookie.includes('=') ? cookie : null;
}

function isSelfRedirect(response: Response, requestUrl: string): boolean {
	const location = response.headers.get('location');
	if (!location || response.status < 300 || response.status >= 400) {
		return false;
	}

	try {
		return new URL(location, requestUrl).toString() === new URL(requestUrl).toString();
	} catch {
		return false;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isZBookFileResponse(value: unknown): value is ZBookFileResponse {
	if (!isRecord(value) || !isRecord(value.file)) return false;
	return typeof value.success === 'number' && typeof value.file.downloadLink === 'string';
}

function isZSearchBookResponse(value: unknown): value is ZSearchBookResponse {
	return isRecord(value) && typeof value.success === 'number' && Array.isArray(value.books);
}

function isZLoginResponse(value: unknown): value is ZLoginResponse {
	return isRecord(value) && (value.success === 0 || value.success === 1) && isRecord(value.user);
}

const ZLibraryRoutes: Record<string, string> = {
	passwordLogin: '/eapi/user/login',
	profile: '/eapi/user/profile',
	search: '/eapi/book/search'
};
