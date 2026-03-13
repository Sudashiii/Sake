export interface StorageObjectInfo {
	key: string;
	size: number;
	lastModified?: Date;
}

export interface StoragePort {
	put(key: string, body: Buffer | Uint8Array | NodeJS.ReadableStream, contentType?: string): Promise<void>;
	get(key: string): Promise<Buffer>;
	delete(key: string): Promise<void>;
	list(prefix: string): Promise<StorageObjectInfo[]>;
}
