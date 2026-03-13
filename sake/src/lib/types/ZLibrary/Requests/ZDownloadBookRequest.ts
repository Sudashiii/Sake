export interface ZDownloadBookRequest {
	bookId: string;
	hash: string;
	title: string;
	upload: boolean;
	extension: string;
	author?: string;
	publisher?: string;
	series?: string;
	volume?: string;
	edition?: string | null;
	identifier?: string;
	pages?: number;
	description?: string;
	cover?: string;
	filesize?: number;
	language?: string;
	year?: number;
	downloadToDevice?: boolean;
}
