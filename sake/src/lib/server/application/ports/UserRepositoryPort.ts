import type { CreateUserAccountInput, UserAccount } from '$lib/server/domain/entities/UserAccount';

export interface UserRepositoryPort {
	count(): Promise<number>;
	getById(id: number): Promise<UserAccount | undefined>;
	getByUsername(username: string): Promise<UserAccount | undefined>;
	create(input: CreateUserAccountInput): Promise<UserAccount>;
	setBasicAuthPasswordHash(userId: number, passwordHash: string | null, updatedAt: string): Promise<void>;
	touchLastLogin(id: number, at: string): Promise<void>;
}
