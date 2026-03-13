import type { BookRepositoryPort } from '$lib/server/application/ports/BookRepositoryPort';
import type { Book } from '$lib/server/domain/entities/Book';
import { apiOk, type ApiResult } from '$lib/server/http/api';

export class GetNewProgressForDeviceUseCase {
	constructor(private readonly bookRepository: BookRepositoryPort) {}

	async execute(deviceId: string): Promise<ApiResult<Book[]>> {
		const books = await this.bookRepository.getBooksWithNewProgressForDevice(deviceId);
		return apiOk(books);
	}
}
