export interface ZBookFileResponse {
	success: number;
	file: {
		downloadLink: string;
		description: string;
		author?: string;
		extension: string;
		allowDownload: boolean;
	};
}