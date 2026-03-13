import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { mimeTypes } from '$lib/server/constants/mimeTypes';
import { apiOk, type ApiResult } from '$lib/server/http/api';

interface ListDavDirectoryInput {
	path: string;
}

interface ListDavDirectoryResult {
	xml: string;
}

function normalizeKey(path: string): string {
	return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

export class ListDavDirectoryUseCase {
	constructor(private readonly storage: StoragePort) {}

	async execute(input: ListDavDirectoryInput): Promise<ApiResult<ListDavDirectoryResult>> {
		const path = input.path === '' ? '' : normalizeKey(input.path);
		const objects = await this.storage.list(path);

		const xml = `
			<D:multistatus xmlns:D="DAV:">
				<D:response>
					<D:href>${path === '' ? '/' : `/${encodeURIComponent(path)}`}</D:href>
					<D:propstat>
						<D:prop>
							<D:resourcetype><D:collection/></D:resourcetype>
							<D:displayname>${path === '' ? 'root' : path.split('/').pop()}</D:displayname>
						</D:prop>
						<D:status>HTTP/1.1 200 OK</D:status>
					</D:propstat>
				</D:response>
				${objects
					.map((obj) => {
						const ext = obj.key.split('.').pop()?.toLowerCase() || 'default';
						const mime = mimeTypes[ext] || mimeTypes.default;
						const display = obj.key.split('/').pop() ?? obj.key;
						const href = `/${encodeURIComponent(obj.key)}`;

						return `
							<D:response>
								<D:href>${href}</D:href>
								<D:propstat>
									<D:prop>
										<D:resourcetype/>
										<D:getcontentlength>${obj.size}</D:getcontentlength>
										<D:getlastmodified>${obj.lastModified?.toUTCString() ?? ''}</D:getlastmodified>
										<D:getcontenttype>${mime}</D:getcontenttype>
										<D:displayname>${display}</D:displayname>
									</D:prop>
									<D:status>HTTP/1.1 200 OK</D:status>
								</D:propstat>
							</D:response>`;
					})
					.join('')}
			</D:multistatus>
		`;

		return apiOk({ xml: xml.trim() });
	}
}
