export interface UserAccount {
	id: number;
	username: string;
	passwordHash: string;
	isDisabled: boolean;
	createdAt: string;
	updatedAt: string;
	lastLoginAt: string | null;
}

export interface CreateUserAccountInput {
	username: string;
	passwordHash: string;
}
