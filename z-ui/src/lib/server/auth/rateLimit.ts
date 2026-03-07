import { json } from '@sveltejs/kit';

interface RateLimitPolicy {
	name: string;
	limit: number;
	windowMs: number;
}

interface RateLimitBucket {
	count: number;
	resetAt: number;
}

export type AuthRateLimitPolicyName =
	| 'bootstrapIp'
	| 'loginIp'
	| 'loginUsername'
	| 'deviceKeyIp'
	| 'deviceKeyUserDevice';

export interface AuthRateLimitAttempt {
	policyName: AuthRateLimitPolicyName;
	key: string;
}

const AUTH_RATE_LIMIT_POLICIES: Record<AuthRateLimitPolicyName, RateLimitPolicy> = {
	bootstrapIp: {
		name: 'auth.bootstrap.ip',
		limit: 5,
		windowMs: 15 * 60 * 1000
	},
	loginIp: {
		name: 'auth.login.ip',
		limit: 10,
		windowMs: 10 * 60 * 1000
	},
	loginUsername: {
		name: 'auth.login.username',
		limit: 10,
		windowMs: 10 * 60 * 1000
	},
	deviceKeyIp: {
		name: 'auth.device_key.ip',
		limit: 10,
		windowMs: 10 * 60 * 1000
	},
	deviceKeyUserDevice: {
		name: 'auth.device_key.user_device',
		limit: 8,
		windowMs: 10 * 60 * 1000
	}
};

const buckets = new Map<string, RateLimitBucket>();

function cleanupExpiredBuckets(now: number): void {
	if (buckets.size < 256) {
		return;
	}

	for (const [bucketKey, bucket] of buckets) {
		if (bucket.resetAt <= now) {
			buckets.delete(bucketKey);
		}
	}
}

function consumeBucket(policy: RateLimitPolicy, key: string, now: number): number | null {
	const bucketKey = `${policy.name}:${key}`;
	const existing = buckets.get(bucketKey);

	if (!existing || existing.resetAt <= now) {
		buckets.set(bucketKey, {
			count: 1,
			resetAt: now + policy.windowMs
		});
		return null;
	}

	if (existing.count >= policy.limit) {
		return Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
	}

	existing.count += 1;
	return null;
}

export function buildRateLimitKeyPart(value: string | null | undefined, fallback: string): string {
	const normalized = value?.trim().toLowerCase();
	return normalized && normalized.length > 0 ? normalized : fallback;
}

export function enforceAuthRateLimits(attempts: readonly AuthRateLimitAttempt[]): Response | null {
	const now = Date.now();
	cleanupExpiredBuckets(now);

	let retryAfterSeconds = 0;

	for (const attempt of attempts) {
		const policy = AUTH_RATE_LIMIT_POLICIES[attempt.policyName];
		const bucketRetryAfter = consumeBucket(policy, attempt.key, now);
		if (bucketRetryAfter !== null) {
			retryAfterSeconds = Math.max(retryAfterSeconds, bucketRetryAfter);
		}
	}

	if (retryAfterSeconds === 0) {
		return null;
	}

	return json(
		{ error: 'Too many authentication attempts. Try again later.' },
		{
			status: 429,
			headers: {
				'Retry-After': String(retryAfterSeconds)
			}
		}
	);
}

export function resetAuthRateLimitsForTests(): void {
	buckets.clear();
}
