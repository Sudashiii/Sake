import type { ZBookFileResponse } from '$lib/types/ZLibrary/Responses/ZBookFileResponse';
import type { ZSearchBookResponse } from '$lib/types/ZLibrary/Responses/ZSearchBookResponse';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';
import type {
	ZLibraryCredentials,
	ZLibraryPort,
	ZLibrarySearchRequest,
	ZLibrarySearchResult
} from '$lib/server/application/ports/ZLibraryPort';
import { toUrlEncoded } from '$lib/server/infrastructure/clients/toUrlEncode';
import type { ZLoginRequest } from '$lib/types/ZLibrary/Requests/ZLoginRequest';
import { apiError, apiOk, type ApiResult } from '$lib/server/http/api';
import {
	buildZLibraryUrl,
	MAX_ZLIBRARY_DOWNLOAD_REDIRECTS,
	normalizeZLibraryMirrorUrls,
	ZLIBRARY_MIRROR_FAILOVER_TIMEOUT_MS,
	ZLIBRARY_REQUEST_TIMEOUT_MS
} from '$lib/server/config/zlibrary';
import {
	ExternalClientError,
	parseExternalJson,
	requestExternal
} from '$lib/server/infrastructure/clients/externalClientPolicy';

interface MirrorAttemptSuccess<T> {
	value: T;
	mirrorUrl: string;
}

type GetTimeoutMs = () => number;

export class ZLibraryClient implements ZLibraryPort {
	private readonly getBaseUrls: () => Promise<readonly string[]>;

	constructor(
		baseUrl: string | (() => Promise<readonly string[]>),
		private readonly fetchFn: typeof fetch = fetch,
		private readonly nowFn: () => number = Date.now
	) {
		this.getBaseUrls = typeof baseUrl === 'string' ? async () => [baseUrl] : baseUrl;
	}

	async search(searchBookRequest: ZLibrarySearchRequest): Promise<ApiResult<ZLibrarySearchResult>> {
		const body: Record<string, unknown> = {};
		const { searchText, yearFrom, yearTo, languages, extensions, order, limit } = searchBookRequest;

		if (searchText) body.message = searchText;
		if (yearFrom) body.yearFrom = yearFrom;
		if (yearTo) body.yearTo = yearTo;
		if (languages?.length) body.languages = languages;
		if (extensions?.length) body.extensions = extensions;
		if (order) body.order = order;
		if (limit !== undefined) body.limit = limit;

		const result = await this.post<ZSearchBookResponse>(ZLibraryRoutes.search, body);
		if (!result.ok) return result;
		return apiOk({ response: result.value.value, mirrorUrl: result.value.mirrorUrl });
	}

	async download(
		bookId: string,
		hash: string,
		credentials: ZLibraryCredentials
	): Promise<ApiResult<Response>> {
		const result = await this.tryMirrors((mirrorUrl, getTimeoutMs) =>
			this.downloadFromMirror(mirrorUrl, bookId, hash, credentials, getTimeoutMs)
		);
		return unwrapMirrorResult(result);
	}

	async signup(_email: string, _name: string, _password: string): Promise<ApiResult<boolean>> {
		return apiError('Method not implemented', 501);
	}

	async passwordLogin(name: string, password: string): Promise<ApiResult<ZLoginResponse>> {
		const request: ZLoginRequest = { email: name, password };
		return unwrapMirrorResult(await this.post<ZLoginResponse>(ZLibraryRoutes.passwordLogin, request));
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
		return unwrapMirrorResult(
			await this.tryMirrors(async (mirrorUrl, getTimeoutMs) => {
				try {
					const response = await this.requestApi(
						buildZLibraryUrl(mirrorUrl, path),
						{
							method: 'GET',
							headers: this.getHeaders(credentials)
						},
						getTimeoutMs
					);

					if (!response.ok) {
						return apiError(`Request failed with status ${response.status}`, getUpstreamErrorStatus(response.status));
					}

					return apiOk(response);
				} catch (cause) {
					return apiError('Failed to execute GET request', getExternalStatus(cause), cause);
				}
			})
		);
	}

	private async post<T>(
		path: string,
		data: object,
		credentials?: ZLibraryCredentials
	): Promise<ApiResult<MirrorAttemptSuccess<T>>> {
		return this.tryMirrors(async (mirrorUrl, getTimeoutMs) => {
			try {
				const response = await this.requestApi(
					buildZLibraryUrl(mirrorUrl, path),
					{
						method: 'POST',
						headers: this.getHeaders(credentials),
						body: toUrlEncoded(data)
					},
					getTimeoutMs
				);
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

	private async downloadFromMirror(
		mirrorUrl: string,
		bookId: string,
		hash: string,
		credentials: ZLibraryCredentials,
		getTimeoutMs: GetTimeoutMs
	): Promise<ApiResult<Response>> {
		let fileInfoResponse: Response;
		try {
			fileInfoResponse = await this.requestApi(
				buildZLibraryUrl(mirrorUrl, `/eapi/book/${bookId}/${hash}/file`),
				{
					method: 'GET',
					headers: this.getHeaders(credentials)
				},
				getTimeoutMs
			);
		} catch (cause) {
			return apiError('Failed to execute download file-info request', getExternalStatus(cause), cause);
		}

		if (!fileInfoResponse.ok) {
			return apiError(
				`Request failed with status ${fileInfoResponse.status}`,
				getUpstreamErrorStatus(fileInfoResponse.status)
			);
		}

		let fileInfo: ZBookFileResponse;
		try {
			fileInfo = await parseExternalJson(fileInfoResponse, isZBookFileResponse);
		} catch (cause) {
			return apiError('Failed to parse download file info', 502, cause);
		}

		let downloadUrl: string;
		try {
			downloadUrl = resolveDownloadUrl(fileInfo.file.downloadLink, mirrorUrl);
		} catch (cause) {
			return apiError(cause instanceof Error ? cause.message : 'Invalid Z-Library download URL', 502, cause);
		}

		return this.fetchDownloadUrl(downloadUrl, mirrorUrl, credentials, getTimeoutMs);
	}

	private async fetchDownloadUrl(
		initialUrl: string,
		mirrorUrl: string,
		credentials: ZLibraryCredentials,
		getTimeoutMs: GetTimeoutMs
	): Promise<ApiResult<Response>> {
		let currentUrl = initialUrl;

		for (let redirectCount = 0; redirectCount <= MAX_ZLIBRARY_DOWNLOAD_REDIRECTS; redirectCount += 1) {
			const cookieAllowed = isSameOrigin(currentUrl, mirrorUrl);
			try {
				const response = await requestExternal(this.fetchFn, currentUrl, {
					method: 'GET',
					headers: this.getHeaders(cookieAllowed ? credentials : undefined),
					timeoutMs: getTimeoutMs(),
					redirect: 'manual',
					allowManualRedirect: true
				});

				if (response.status >= 300 && response.status < 400) {
					const location = response.headers.get('location');
					if (!location) {
						return apiError('Z-Library download redirect did not include a location', 502);
					}

					const nextUrl = new URL(location, currentUrl);
					if (nextUrl.protocol !== 'https:') {
						return apiError('Z-Library download redirects must use HTTPS', 502);
					}
					currentUrl = nextUrl.toString();
					continue;
				}

				if (!response.ok) {
					return apiError(`Request failed with status ${response.status}`, getUpstreamErrorStatus(response.status));
				}
				return apiOk(response);
			} catch (cause) {
				return apiError('Failed to download Z-Library file', getExternalStatus(cause), cause);
			}
		}

		return apiError('Z-Library download followed too many redirects', 502);
	}

	private async requestApi(url: string, init: RequestInit, getTimeoutMs: GetTimeoutMs): Promise<Response> {
		const response = await requestExternal(this.fetchFn, url, {
			...init,
			timeoutMs: getTimeoutMs(),
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
			timeoutMs: getTimeoutMs(),
			redirect: 'manual',
			allowManualRedirect: true,
			headers
		});
	}

	private async tryMirrors<T>(
		request: (mirrorUrl: string, getTimeoutMs: GetTimeoutMs) => Promise<ApiResult<T>>
	): Promise<ApiResult<MirrorAttemptSuccess<T>>> {
		let urls: readonly string[];
		try {
			urls = normalizeZLibraryMirrorUrls(await this.getBaseUrls());
		} catch (cause) {
			return apiError('Failed to load Z-Library mirror configuration', 500, cause);
		}

		const deadline = this.nowFn() + ZLIBRARY_MIRROR_FAILOVER_TIMEOUT_MS;
		let lastFailure: ApiResult<T> | null = null;
		for (const mirrorUrl of urls) {
			const getTimeoutMs = () => Math.min(ZLIBRARY_REQUEST_TIMEOUT_MS, Math.max(0, deadline - this.nowFn()));
			if (getTimeoutMs() <= 0) break;

			const result = await request(mirrorUrl, getTimeoutMs);
			if (result.ok) return apiOk({ value: result.value, mirrorUrl });
			if (!shouldTryNextMirror(result.error)) return result;
			lastFailure = result;
			if (getTimeoutMs() <= 0) break;
		}

		return lastFailure ?? apiError('Z-Library mirror failover timed out', 504);
	}
}

function unwrapMirrorResult<T>(result: ApiResult<MirrorAttemptSuccess<T>>): ApiResult<T> {
	return result.ok ? apiOk(result.value.value) : result;
}

function resolveDownloadUrl(downloadLink: string, mirrorUrl: string): string {
	const normalizedLink = downloadLink.trim();
	if (!normalizedLink) throw new Error('Z-Library download link is required');

	let url: URL;
	try {
		url = new URL(normalizedLink);
	} catch {
		url = new URL(buildZLibraryUrl(mirrorUrl, normalizedLink));
	}

	if (url.protocol !== 'https:') {
		throw new Error('Z-Library download links must use HTTPS');
	}
	return url.toString();
}

function isSameOrigin(left: string, right: string): boolean {
	try {
		return new URL(left).origin === new URL(right).origin;
	} catch {
		return false;
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
