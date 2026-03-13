import { env } from '$env/dynamic/private';
import { createChildLogger } from '$lib/server/infrastructure/logging/logger';
import { resolveInfrastructureConfig } from './infrastructure.shared.js';

const infraLogger = createChildLogger({ component: 'infrastructureConfig' });

let cachedConfig: ReturnType<typeof resolveInfrastructureConfig> | null = null;
let loggedConfig = false;

function describeTarget(raw: string): string {
	try {
		const url = new URL(raw);
		if (url.protocol === 'file:') {
			return `file:${url.pathname}`;
		}

		return `${url.protocol}//${url.host}`;
	} catch {
		return raw;
	}
}

function logResolvedConfig(config: ReturnType<typeof resolveInfrastructureConfig>): void {
	if (loggedConfig) {
		return;
	}

	loggedConfig = true;

	infraLogger.info(
		{
			event: 'infra.config.resolved',
			libsql: {
				target: describeTarget(config.libsql.url),
				authTokenConfigured: Boolean(config.libsql.authToken)
			},
			s3: {
				provider: config.s3.provider,
				target: describeTarget(config.s3.endpoint),
				region: config.s3.region,
				bucket: config.s3.bucket,
				forcePathStyle: config.s3.forcePathStyle
			}
		},
		'Resolved infrastructure configuration'
	);
}

export function getInfrastructureConfig(): ReturnType<typeof resolveInfrastructureConfig> {
	if (!cachedConfig) {
		cachedConfig = resolveInfrastructureConfig(env);
	}

	logResolvedConfig(cachedConfig);
	return cachedConfig;
}

export function getLibsqlConfig() {
	return getInfrastructureConfig().libsql;
}

export function getS3Config() {
	return getInfrastructureConfig().s3;
}
