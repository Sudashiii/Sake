export interface ZSearchBookRequest {
    searchText: string;
    yearFrom?: string;
    yearTo?: string;
    languages?: string[];
    extensions?: string[];
    order?: string;
    limit?: number;
}