import type { UserAccount } from '$lib/server/domain/entities/UserAccount';

export interface SessionAuthActor {
	type: 'session';
	user: UserAccount;
	sessionId: number;
}

export interface ApiKeyAuthActor {
	type: 'api_key';
	user: UserAccount;
	apiKeyId: number;
	deviceId: string;
	scope: string;
}

export type AuthActor = SessionAuthActor | ApiKeyAuthActor;
