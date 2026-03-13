import {
	S3Client,
	ListObjectsV2Command,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand
} from '@aws-sdk/client-s3';
import type { StoragePort } from '$lib/server/application/ports/StoragePort';
import { Readable } from 'stream';
import { getS3Config } from '$lib/server/config/infrastructure';

export class S3Storage implements StoragePort {
	private readonly s3: S3Client;
	private readonly bucket: string;

	constructor() {
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
				// @ts-ignore AWS SDK Body union is wider at runtime than TS infers here
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

	async delete(key: string): Promise<void> {
		await this.s3.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: key
			})
		);
	}

	async list(prefix: string): Promise<{ key: string; size: number; lastModified?: Date }[]> {
		const res = await this.s3.send(
			new ListObjectsV2Command({
				Bucket: this.bucket,
				Prefix: prefix
			})
		);

		return (
			res.Contents?.map((obj) => ({
				key: obj.Key!,
				size: obj.Size ?? 0,
				lastModified: obj.LastModified
			})) ?? []
		);
	}
}
