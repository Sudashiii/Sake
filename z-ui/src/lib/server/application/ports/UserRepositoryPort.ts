import type { CreateUserAccountInput, UserAccount } from '$lib/server/domain/entities/UserAccount';

export interface UserRepositoryPort {
	count(): Promise<number>;
	getById(id: number): Promise<UserAccount | undefined>;
	getByUsername(username: string): Promise<UserAccount | undefined>;
	create(input: CreateUserAccountInput): Promise<UserAccount>;
	touchLastLogin(id: number, at: string): Promise<void>;
}
