/**
 * @typedef {Record<string, string | undefined | null>} EnvSource
 */

/**
 * @typedef {{
 *   url: string;
 *   authToken?: string;
 * }} ResolvedLibsqlConfig
 */

/**
 * @typedef {{
 *   endpoint: string;
 *   region: string;
 *   bucket: string;
 *   accessKeyId: string;
 *   secretAccessKey: string;
 *   forcePathStyle: boolean;
 *   provider: 'r2' | 's3-compatible';
 * }} ResolvedS3Config
 */

/**
 * @typedef {{
 *   libsql: ResolvedLibsqlConfig;
 *   s3: ResolvedS3Config;
 * }} ResolvedInfrastructureConfig
 */

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function hasText(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function toTrimmed(value) {
	return hasText(value) ? value.trim() : undefined;
}

/**
 * @param {string | undefined} value
 * @returns {boolean}
 */
function parseBoolean(value) {
	if (!value) {
		return false;
	}

	switch (value.trim().toLowerCase()) {
		case '1':
		case 'true':
		case 'yes':
		case 'on':
			return true;
		default:
			return false;
	}
}

/**
 * @param {string} endpoint
 * @returns {boolean}
 */
function isR2Endpoint(endpoint) {
	try {
		const url = new URL(endpoint);
		return url.hostname.endsWith('.r2.cloudflarestorage.com');
	} catch {
		return endpoint.includes('.r2.cloudflarestorage.com');
	}
}

/**
 * @param {EnvSource} env
 * @param {string} key
 * @param {string} message
 * @returns {string}
 */
function requireValue(env, key, message) {
	const value = toTrimmed(env[key]);
	if (!value) {
		throw new Error(message);
	}

	return value;
}

/**
 * @param {EnvSource} env
 * @returns {ResolvedLibsqlConfig}
 */
export function resolveLibsqlConfig(env) {
	const url = requireValue(env, 'LIBSQL_URL', 'Missing libSQL configuration: set LIBSQL_URL');
	const authToken = toTrimmed(env.LIBSQL_AUTH_TOKEN);

	return {
		url,
		...(authToken ? { authToken } : {})
	};
}

/**
 * @param {EnvSource} env
 * @returns {ResolvedS3Config}
 */
export function resolveS3Config(env) {
	const endpoint = requireValue(env, 'S3_ENDPOINT', 'Missing S3 configuration: set S3_ENDPOINT');
	const bucket = requireValue(env, 'S3_BUCKET', 'Missing S3 configuration: set S3_BUCKET');
	const accessKeyId = requireValue(
		env,
		'S3_ACCESS_KEY_ID',
		'Missing S3 configuration: set S3_ACCESS_KEY_ID'
	);
	const secretAccessKey = requireValue(
		env,
		'S3_SECRET_ACCESS_KEY',
		'Missing S3 configuration: set S3_SECRET_ACCESS_KEY'
	);
	const provider = isR2Endpoint(endpoint) ? 'r2' : 's3-compatible';
	const explicitRegion = toTrimmed(env.S3_REGION);
	const region = explicitRegion ?? (provider === 'r2' ? 'auto' : 'us-east-1');
	const forcePathStyle = parseBoolean(toTrimmed(env.S3_FORCE_PATH_STYLE));

	return {
		endpoint,
		region,
		bucket,
		accessKeyId,
		secretAccessKey,
		forcePathStyle,
		provider
	};
}

/**
 * @param {EnvSource} env
 * @returns {ResolvedInfrastructureConfig}
 */
export function resolveInfrastructureConfig(env) {
	const libsql = resolveLibsqlConfig(env);
	const s3 = resolveS3Config(env);

	return {
		libsql,
		s3
	};
}
