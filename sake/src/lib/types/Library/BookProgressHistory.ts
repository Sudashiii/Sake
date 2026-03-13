export interface BookProgressHistoryEntry {
	progressPercent: number;
	recordedAt: string;
}

export interface BookProgressHistoryResponse {
	success: boolean;
	bookId: number;
	history: BookProgressHistoryEntry[];
}

