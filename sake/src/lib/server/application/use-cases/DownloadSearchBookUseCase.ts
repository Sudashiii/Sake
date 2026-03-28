import type {
	SearchProviderDownloadInput,
	SearchProviderDownloadResult,
	SearchProviderPort
} from '$lib/server/application/ports/SearchProviderPort';
import { supportsSearchProviderDownload } from '$lib/server/application/ports/SearchProviderPort';
import { SearchProviderRegistry } from '$lib/server/application/services/SearchProviderRegistry';
import { apiError, type ApiResult } from '$lib/server/http/api';
import type { SearchProviderId } from '$lib/types/Search/Provider';

interface DownloadSearchBookInput extends SearchProviderDownloadInput {
	provider: SearchProviderId;
}

function hasText(value: string | null | undefined): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

export class DownloadSearchBookUseCase {
	private readonly providerRegistry: SearchProviderRegistry;

	constructor(providers: SearchProviderPort[]) {
		this.providerRegistry = new SearchProviderRegistry(providers);
	}

	async execute(
		input: DownloadSearchBookInput
	): Promise<ApiResult<SearchProviderDownloadResult>> {
		const title = input.title.trim();
		if (!title) {
			return apiError('title is required', 400);
		}
		if (!hasText(input.downloadRef)) {
			return apiError('downloadRef is required', 400);
		}

		const provider = this.providerRegistry.find(input.provider);
		if (!provider) {
			return apiError(`Unknown provider requested: ${input.provider}`, 400);
		}
		if (!supportsSearchProviderDownload(provider)) {
			return apiError('Provider does not support generic search download', 400);
		}

		try {
			return await provider.download({
				downloadRef: input.downloadRef.trim(),
				title,
				extension: input.extension
			});
		} catch (cause: unknown) {
			return apiError('Provider download failed unexpectedly', 502, cause);
		}
	}
}
