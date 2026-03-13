export interface LibraryBookDetail {
	success: boolean;
	bookId: number;
	title: string;
	author: string | null;
	publisher: string | null;
	series: string | null;
	volume: string | null;
	edition: string | null;
	identifier: string | null;
	pages: number | null;
	description: string | null;
	googleBooksId: string | null;
	openLibraryKey: string | null;
	amazonAsin: string | null;
	externalRating: number | null;
	externalRatingCount: number | null;
	progressPercent: number | null;
	rating: number | null;
	isRead: boolean;
	readAt: string | null;
	isArchived: boolean;
	archivedAt: string | null;
	excludeFromNewBooks: boolean;
	downloadedDevices: string[];
	shelfIds: number[];
}
