import { ZLibrarySearchUseCase } from '$lib/server/application/use-cases/ZLibrarySearchUseCase';
import { LookupSearchBookMetadataUseCase } from '$lib/server/application/use-cases/LookupSearchBookMetadataUseCase';
import { SearchBooksUseCase } from '$lib/server/application/use-cases/SearchBooksUseCase';
import { DownloadSearchBookUseCase } from '$lib/server/application/use-cases/DownloadSearchBookUseCase';
import { ZLibraryTokenLoginUseCase } from '$lib/server/application/use-cases/ZLibraryTokenLoginUseCase';
import { ZLibraryPasswordLoginUseCase } from '$lib/server/application/use-cases/ZLibraryPasswordLoginUseCase';
import { ZLibraryLogoutUseCase } from '$lib/server/application/use-cases/ZLibraryLogoutUseCase';
import {
	activeSearchProviderInstances,
	activeSearchProviders,
	allSearchProviderInstances,
	externalBookMetadataService
} from './providers';
import { zlibraryClient } from './foundation';

export const zlibrarySearchUseCase = new ZLibrarySearchUseCase(zlibraryClient);
export const lookupSearchBookMetadataUseCase = new LookupSearchBookMetadataUseCase(
	externalBookMetadataService
);
export const searchBooksUseCase = new SearchBooksUseCase(
	activeSearchProviderInstances,
	activeSearchProviders
);
export const downloadSearchBookUseCase = new DownloadSearchBookUseCase(allSearchProviderInstances);
export const zlibraryTokenLoginUseCase = new ZLibraryTokenLoginUseCase(zlibraryClient);
export const zlibraryPasswordLoginUseCase = new ZLibraryPasswordLoginUseCase(zlibraryClient);
export const zlibraryLogoutUseCase = new ZLibraryLogoutUseCase();
