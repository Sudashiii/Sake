export interface Shelf {
	id: number;
	name: string;
	icon: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateShelfInput {
	name: string;
	icon: string;
}

export interface UpdateShelfInput {
	name: string;
	icon: string;
}
