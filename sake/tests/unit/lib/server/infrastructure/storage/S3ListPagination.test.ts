import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { listAllS3Objects } from '$lib/server/infrastructure/storage/S3ListPagination';

function page(
	contents: ListObjectsV2CommandOutput['Contents'],
	options: Pick<ListObjectsV2CommandOutput, 'IsTruncated' | 'NextContinuationToken'> = {}
): ListObjectsV2CommandOutput {
	return { $metadata: {}, Contents: contents, ...options };
}

describe('listAllS3Objects', () => {
	test('follows continuation tokens across pages', async () => {
		const commands: ListObjectsV2Command[] = [];
		const responses = [
			page([{ Key: 'library/first.epub', Size: 1 }], {
				IsTruncated: true,
				NextContinuationToken: 'page-2'
			}),
			page([{ Key: 'library/second.epub', Size: 2 }])
		];

		const objects = await listAllS3Objects(async (command) => {
			commands.push(command);
			const response = responses.shift();
			if (!response) {
				throw new Error('unexpected S3 request');
			}
			return response;
		}, 'sake', 'library/');

		assert.deepEqual(objects, [
			{ Key: 'library/first.epub', Size: 1 },
			{ Key: 'library/second.epub', Size: 2 }
		]);
		assert.equal(commands.length, 2);
		assert.equal(commands[0].input.ContinuationToken, undefined);
		assert.equal(commands[1].input.ContinuationToken, 'page-2');
	});

	test('does not stop on an empty intermediate page', async () => {
		let requestCount = 0;
		const objects = await listAllS3Objects(async () => {
			requestCount += 1;
			if (requestCount === 1) {
				return page([], { IsTruncated: true, NextContinuationToken: 'page-2' });
			}

			return page([{ Key: 'library/after-empty.epub', Size: 3 }]);
		}, 'sake', 'library/');

		assert.deepEqual(objects, [{ Key: 'library/after-empty.epub', Size: 3 }]);
		assert.equal(requestCount, 2);
	});

	test('rejects truncated responses without progressing continuation state', async () => {
		await assert.rejects(
			() =>
				listAllS3Objects(
					async () => page([], { IsTruncated: true, NextContinuationToken: 'same-token' }),
					'sake',
					'library/'
				),
			/S3 object listing was truncated without a progressing continuation token/
		);
	});
});
