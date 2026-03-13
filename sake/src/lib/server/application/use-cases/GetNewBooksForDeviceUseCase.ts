import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { Book } from '$lib/server/domain/entities/Book';

export class GetNewBooksForDeviceUseCase {
	constructor(private readonly bookRepository: BookRepositoryPort) {}

	async execute(deviceId: string): Promise<ApiResult<Book[]>> {
		const books = await this.bookRepository.getNotDownloadedByDevice(deviceId);
		return apiOk(books);
	}
}
