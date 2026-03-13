import type { CreateShelfInput, Shelf, UpdateShelfInput } from '$lib/server/domain/entities/Shelf';

export interface ShelfRepositoryPort {
	list(): Promise<Shelf[]>;
	listByIds(ids: number[]): Promise<Shelf[]>;
	getById(id: number): Promise<Shelf | undefined>;
	create(input: CreateShelfInput): Promise<Shelf>;
	update(id: number, input: UpdateShelfInput): Promise<Shelf | undefined>;
	reorder(shelfIds: number[]): Promise<void>;
	delete(id: number): Promise<void>;
	getBookShelfIds(bookId: number): Promise<number[]>;
	getBookShelfIdsForBooks(bookIds: number[]): Promise<Record<number, number[]>>;
	setBookShelfIds(bookId: number, shelfIds: number[]): Promise<void>;
}
