export interface HardcoverProgressSyncPort {
	isEnabled(): Promise<boolean>;
	enqueueBook(bookId: number, isInitialSync?: boolean): Promise<void>;
	reconcile(isInitialSync?: boolean): Promise<number>;
	processPending(): Promise<void>;
}
