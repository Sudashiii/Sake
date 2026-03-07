export interface AuthApiKey {
	id: number;
	deviceId: string;
	keyPreview: string;
	createdAt: string;
	lastUsedAt: string | null;
	expiresAt: string | null;
}

export interface AuthApiKeysResponse {
	success: true;
	apiKeys: AuthApiKey[];
}
