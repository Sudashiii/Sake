import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveInfrastructureConfig, resolveLibsqlConfig, resolveS3Config } from '$lib/server/config/infrastructure.shared.js';

describe('infrastructureConfig', () => {
	test('resolves generic libSQL and S3 configuration', () => {
		const config = resolveInfrastructureConfig({
			LIBSQL_URL: 'file:/data/sake.db',
			S3_ENDPOINT: 'http://minio:9000',
			S3_REGION: 'us-east-1',
			S3_BUCKET: 'sake',
			S3_ACCESS_KEY_ID: 'minioadmin',
			S3_SECRET_ACCESS_KEY: 'minioadmin',
			S3_FORCE_PATH_STYLE: 'true'
		});

		assert.equal(config.libsql.url, 'file:/data/sake.db');
		assert.equal(config.libsql.authToken, undefined);
		assert.equal(config.s3.endpoint, 'http://minio:9000');
		assert.equal(config.s3.region, 'us-east-1');
		assert.equal(config.s3.forcePathStyle, true);
		assert.equal(config.s3.provider, 's3-compatible');
	});

	test('detects R2 through the generic S3 endpoint and defaults region to auto', () => {
		const config = resolveInfrastructureConfig({
			LIBSQL_URL: 'https://example.turso.io',
			LIBSQL_AUTH_TOKEN: 'secret-token',
			S3_ENDPOINT: 'https://acct123.r2.cloudflarestorage.com',
			S3_BUCKET: 'sake',
			S3_ACCESS_KEY_ID: 'r2-key',
			S3_SECRET_ACCESS_KEY: 'r2-secret'
		});

		assert.equal(config.libsql.url, 'https://example.turso.io');
		assert.equal(config.libsql.authToken, 'secret-token');
		assert.equal(config.s3.endpoint, 'https://acct123.r2.cloudflarestorage.com');
		assert.equal(config.s3.region, 'auto');
		assert.equal(config.s3.provider, 'r2');
	});

	test('supports tokenless libSQL config', () => {
		const config = resolveLibsqlConfig({
			LIBSQL_URL: 'http://libsql:8080'
		});

		assert.equal(config.url, 'http://libsql:8080');
		assert.equal(config.authToken, undefined);
	});

	test('defaults generic S3 region to us-east-1 and path style to false', () => {
		const config = resolveS3Config({
			S3_ENDPOINT: 'http://minio:9000',
			S3_BUCKET: 'sake',
			S3_ACCESS_KEY_ID: 'key',
			S3_SECRET_ACCESS_KEY: 'secret'
		});

		assert.equal(config.region, 'us-east-1');
		assert.equal(config.forcePathStyle, false);
	});
});
