import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_LENGTH = 64;
const SESSION_TOKEN_BYTES = 32;
const API_KEY_TOKEN_BYTES = 32;
const API_KEY_PREFIX_LENGTH = 16;

function toBase64Url(value: Buffer): string {
	return value.toString('base64url');
}

export function hashOpaqueToken(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(PASSWORD_SALT_BYTES);
	const derived = (await scryptAsync(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
	return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const [algorithm, saltHex, hashHex] = storedHash.split(':');
	if (algorithm !== 'scrypt' || !saltHex || !hashHex) {
		return false;
	}

	const salt = Buffer.from(saltHex, 'hex');
	const expected = Buffer.from(hashHex, 'hex');
	const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;

	if (derived.length !== expected.length) {
		return false;
	}

	return timingSafeEqual(derived, expected);
}

export function createSessionToken(): { token: string; tokenHash: string } {
	const token = toBase64Url(randomBytes(SESSION_TOKEN_BYTES));
	return {
		token,
		tokenHash: hashOpaqueToken(token)
	};
}

export function createApiKey(): { key: string; keyHash: string; keyPrefix: string } {
	const raw = toBase64Url(randomBytes(API_KEY_TOKEN_BYTES));
	const key = `sake_${raw}`;
	return {
		key,
		keyHash: hashOpaqueToken(key),
		keyPrefix: key.slice(0, API_KEY_PREFIX_LENGTH)
	};
}
