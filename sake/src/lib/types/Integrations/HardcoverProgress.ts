export interface HardcoverProgressSyncStatus {
	tokenConfigured: boolean;
	enabled: boolean;
	available: boolean;
	demoMode: boolean;
	lastSuccessfulSyncAt: string | null;
	counts: {
		pending: number;
		processing: number;
		completed: number;
		failed: number;
		skipped: number;
	};
}

export interface TriggerHardcoverProgressSyncResponse {
	success: true;
	enqueued: number;
}
