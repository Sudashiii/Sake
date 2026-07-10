import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';

type ListObjectsV2Sender = (command: ListObjectsV2Command) => Promise<ListObjectsV2CommandOutput>;

export async function listAllS3Objects(
	send: ListObjectsV2Sender,
	bucket: string,
	prefix: string
): Promise<NonNullable<ListObjectsV2CommandOutput['Contents']>> {
	const objects: NonNullable<ListObjectsV2CommandOutput['Contents']> = [];
	let continuationToken: string | undefined;
	const seenContinuationTokens = new Set<string>();

	while (true) {
		const response = await send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: continuationToken
			})
		);

		objects.push(...(response.Contents ?? []));

		if (!response.IsTruncated) {
			return objects;
		}

		const nextContinuationToken = response.NextContinuationToken;
		if (!nextContinuationToken || seenContinuationTokens.has(nextContinuationToken)) {
			throw new Error('S3 object listing was truncated without a progressing continuation token');
		}

		seenContinuationTokens.add(nextContinuationToken);
		continuationToken = nextContinuationToken;
	}
}
