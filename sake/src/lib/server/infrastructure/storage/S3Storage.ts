import {
	S3Client,
	S3ServiceException,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
} from '@aws-sdk/client-s3';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { Readable } from 'stream';
import { getS3Config } from '$lib/server/config/infrastructure';
import { listAllS3Objects } from './S3ListPagination';

export class S3Storage implements StoragePort {
	private readonly s3: S3Client;
	private readonly bucket: string;

	constructor(s3Client?: S3Client, bucket?: string) {
		if (s3Client) {
			this.s3 = s3Client;
			this.bucket = bucket ?? '';
			return;
		}

		const config = getS3Config();
		this.bucket = config.bucket;

		this.s3 = new S3Client({
			region: config.region,
			endpoint: config.endpoint,
			forcePathStyle: config.forcePathStyle,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey
			}
		});
	}

	async put(
		key: string,
		body: Buffer | Uint8Array | NodeJS.ReadableStream,
		contentType?: string
	): Promise<void> {
		await this.s3.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				// @ts-expect-error AWS SDK's Node stream type is narrower than the port's runtime-compatible stream contract.
				Body: body,
				ContentType: contentType ?? 'application/octet-stream'
			})
		);
	}

	async get(key: string): Promise<Buffer> {
		const response = await this.s3.send(
			new GetObjectCommand({
				Bucket: this.bucket,
				Key: key
			})
		);

		if (!response.Body) {
			throw new Error(`Object not found at key: ${key}`);
		}

		const stream = response.Body as Readable;
		const chunks: Buffer[] = [];

		for await (const chunk of stream) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}

		return Buffer.concat(chunks);
	}

	async exists(key: string): Promise<boolean> {
		try {
			await this.s3.send(
				new HeadObjectCommand({
					Bucket: this.bucket,
					Key: key
				})
			);
			return true;
		} catch (error: unknown) {
			if (
				error instanceof S3ServiceException &&
				(error.name === 'NotFound' || error.name === 'NoSuchKey' || error.$metadata.httpStatusCode === 404)
			) {
				return false;
			}
			throw error;
		}
	}

	async delete(key: string): Promise<void> {
		await this.s3.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: key
			})
		);
	}

	async list(prefix: string): Promise<{ key: string; size: number; lastModified?: Date }[]> {
		const contents = await listAllS3Objects((command) => this.s3.send(command), this.bucket, prefix);

		return (
			contents?.map((obj) => ({
				key: obj.Key!,
				size: obj.Size ?? 0,
				lastModified: obj.LastModified
			})) ?? []
		);
	}
}
