export interface RatedBook {
	id: number;
	title: string;
	author: string | null;
	extension: string | null;
	rating: number;
}
