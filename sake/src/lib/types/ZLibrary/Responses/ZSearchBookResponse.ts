import type { ZBook } from "../ZBook";

export interface ZSearchBookResponse {
    success: number;
    books: ZBook[];
}