import type { ApiResult } from '$lib/server/http/api';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';
import type { ZSearchBookResponse } from '$lib/types/ZLibrary/Responses/ZSearchBookResponse';

export interface ZLibraryCredentials {
	userId: string;
	userKey: string;
}

export interface ZLibrarySearchRequest {
	searchText: string;
	yearFrom?: string;
	yearTo?: string;
	languages?: string[];
	extensions?: string[];
	order?: 'asc' | 'desc';
	limit?: number;
}

export interface ZLibraryPort {
	signup(email: string, name: string, password: string): Promise<ApiResult<boolean>>;
	passwordLogin(name: string, password: string): Promise<ApiResult<ZLoginResponse>>;
	tokenLogin(id: string, token: string): Promise<ApiResult<void>>;
	search(searchBookRequest: ZLibrarySearchRequest): Promise<ApiResult<ZSearchBookResponse>>;
	download(bookId: string, hash: string, credentials: ZLibraryCredentials): Promise<ApiResult<Response>>;
}
