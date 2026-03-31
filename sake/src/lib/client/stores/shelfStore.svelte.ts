import { ZUI } from '$lib/client/zui';
import type { ApiError } from '$lib/types/ApiError';
import type { LibraryShelf } from '$lib/types/Library/Shelf';
import { ok, type Result } from '$lib/types/Result';

export class ShelfStore {
	shelves = $state<LibraryShelf[]>([]);
	isLoading = $state(false);
	error = $state<ApiError | null>(null);
	hasLoaded = $state(false);

	private loadPromise: Promise<Result<LibraryShelf[], ApiError>> | null = null;

	async load(options?: { force?: boolean }): Promise<Result<LibraryShelf[], ApiError>> {
		const force = options?.force ?? false;
		if (!force) {
			if (this.loadPromise) {
				return this.loadPromise;
			}
			if (this.hasLoaded) {
				return ok(this.shelves);
			}
		}

		const promise = this.fetchShelves();
		this.loadPromise = promise;

		try {
			return await promise;
		} finally {
			if (this.loadPromise === promise) {
				this.loadPromise = null;
			}
		}
	}

	async reload(): Promise<Result<LibraryShelf[], ApiError>> {
		return this.load({ force: true });
	}

	replace(shelves: LibraryShelf[]): void {
		this.shelves = shelves;
		this.error = null;
		this.hasLoaded = true;
	}

	invalidate(): void {
		this.hasLoaded = false;
	}

	private async fetchShelves(): Promise<Result<LibraryShelf[], ApiError>> {
		this.isLoading = true;

		const result = await ZUI.getLibraryShelves();
		this.isLoading = false;

		if (!result.ok) {
			this.error = result.error;
			return result;
		}

		this.replace(result.value.shelves);
		return ok(result.value.shelves);
	}
}

export const shelfStore = new ShelfStore();
