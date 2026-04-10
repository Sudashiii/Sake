export interface CurrentUser {
	id: number;
	username: string;
	isDisabled: boolean;
	hasBasicAuthPassword: boolean;
	lastLoginAt: string | null;
	createdAt: string;
}

export interface CurrentUserResponse {
	success: true;
	user: CurrentUser;
}
