export interface UserAccount {
	id: number;
	username: string;
	passwordHash: string;
	basicAuthPasswordHash: string | null;
	isDisabled: boolean;
	createdAt: string;
	updatedAt: string;
	lastLoginAt: string | null;
}

export interface CreateUserAccountInput {
	username: string;
	passwordHash: string;
}
