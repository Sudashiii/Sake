import { apiOk, type ApiResult } from '$lib/server/http/api';
import type { WebappLogObservation, WebappLogFeedPort } from '../ports/WebappLogFeedPort';

export class ObserveWebappLogsUseCase {
	constructor(private readonly webappLogFeed: WebappLogFeedPort) {}

	async execute(): Promise<ApiResult<WebappLogObservation>> {
		return apiOk(this.webappLogFeed.observe());
	}
}
