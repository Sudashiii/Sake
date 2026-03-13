import { S3Storage } from '$lib/server/infrastructure/storage/S3Storage';
import { DavUploadService } from '$lib/server/infrastructure/services/DavUploadService';

export class DavUploadServiceFactory {
	static createS3(): DavUploadService {
		const s3 = new S3Storage();
		return new DavUploadService(s3);
	}
}
