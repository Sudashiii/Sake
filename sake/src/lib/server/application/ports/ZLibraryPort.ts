import type { ApiResult } from '$lib/server/http/api';
import type { ZSearchBookRequest } from '$lib/types/ZLibrary/Requests/ZSearchBookRequest';
import type { ZLoginResponse } from '$lib/types/ZLibrary/Responses/ZLoginResponse';
import type { ZSearchBookResponse } from '$lib/types/ZLibrary/Responses/ZSearchBookResponse';

export interface ZLibraryCredentials {
	userId: string;
	userKey: string;
}

export interface ZLibraryPort {
	signup(email: string, name: string, password: string): Promise<ApiResult<boolean>>;
	passwordLogin(name: string, password: string): Promise<ApiResult<ZLoginResponse>>;
	tokenLogin(id: string, token: string): Promise<ApiResult<void>>;
	search(searchBookRequest: ZSearchBookRequest): Promise<ApiResult<ZSearchBookResponse>>;
	download(bookId: string, hash: string, credentials: ZLibraryCredentials): Promise<ApiResult<Response>>;
}
