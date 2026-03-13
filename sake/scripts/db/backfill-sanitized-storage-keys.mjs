import { createClient } from '@libsql/client';
import {
	S3Client,
	CopyObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand
} from '@aws-sdk/client-s3';
import {
	resolveLibsqlConfig,
	resolveS3Config
} from '../../src/lib/server/config/infrastructure.shared.js';

const args = new Set(process.argv.slice(2));
const applyMode = args.has('--apply');
const enableDedupe = args.has('--dedupe');
const dryRun = !applyMode;

const libsql = resolveLibsqlConfig(process.env);
const s3Config = resolveS3Config(process.env);

const db = createClient({
	url: libsql.url,
	...(libsql.authToken ? { authToken: libsql.authToken } : {})
});
const s3 = new S3Client({
	region: s3Config.region,
	endpoint: s3Config.endpoint,
	forcePathStyle: s3Config.forcePathStyle,
	credentials: {
		accessKeyId: s3Config.accessKeyId,
		secretAccessKey: s3Config.secretAccessKey
	}
});
const bucket = s3Config.bucket;

function transliterate(value) {
	return value
		.replace(/Ä/g, 'Ae')
		.replace(/Ö/g, 'Oe')
		.replace(/Ü/g, 'Ue')
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/&/g, ' and ')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '');
}

function normalizeSegment(value, fallback) {
	const ascii = transliterate(value)
		.replace(/[^A-Za-z0-9._-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return ascii.length > 0 ? ascii : fallback;
}

function sanitizeLibraryStorageKey(rawKey, fallback = 'download.bin') {
	const input = String(rawKey ?? '').trim();
	if (!input) {
		return fallback;
	}

	const slashNormalized = input.replace(/[\\/]+/g, '_');
	const lastDot = slashNormalized.lastIndexOf('.');
	if (lastDot <= 0 || lastDot === slashNormalized.length - 1) {
		return normalizeSegment(slashNormalized, fallback);
	}

	const name = slashNormalized.slice(0, lastDot);
	const ext = slashNormalized.slice(lastDot + 1);
	const normalizedName = normalizeSegment(name, 'download');
	const normalizedExt = normalizeSegment(ext, 'bin').replace(/\./g, '_');
	return `${normalizedName}.${normalizedExt}`;
}

function buildProgressKey(storageKey) {
	const lastDot = storageKey.lastIndexOf('.');
	if (lastDot <= 0 || lastDot === storageKey.length - 1) {
		return null;
	}

	const extension = storageKey.slice(lastDot + 1);
	const baseName = storageKey.slice(0, lastDot);
	return `${baseName}.sdr/metadata.${extension}.lua`;
}

function parseDateValue(value) {
	if (!value) {
		return 0;
	}
	const ms = Date.parse(String(value));
	return Number.isFinite(ms) ? ms : 0;
}

async function headObject(key) {
	try {
		await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
		return true;
	} catch {
		return false;
	}
}

async function copyObject(fromKey, toKey) {
	await s3.send(
		new CopyObjectCommand({
			Bucket: bucket,
			CopySource: `${bucket}/${encodeURIComponent(fromKey).replace(/%2F/g, '/')}`,
			Key: toKey
		})
	);
}

async function deleteObject(key) {
	await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function fetchRows() {
	const result = await db.execute(
		`SELECT id, s3_storage_key, progress_storage_key, progress_updated_at, createdAt
		 FROM Books
		 ORDER BY id ASC`
	);

	return result.rows.map((row) => ({
		id: Number(row.id),
		s3StorageKey: String(row.s3_storage_key),
		progressStorageKey: row.progress_storage_key ? String(row.progress_storage_key) : null,
		progressUpdatedAt: row.progress_updated_at ? String(row.progress_updated_at) : null,
		createdAt: row.createdAt ? String(row.createdAt) : null
	}));
}

function buildPlans(rows) {
	return rows.map((row) => {
		const newStorageKey = sanitizeLibraryStorageKey(row.s3StorageKey);
		const newProgressKey = row.progressStorageKey ? buildProgressKey(newStorageKey) : null;
		return {
			...row,
			newStorageKey,
			newProgressKey,
			needsUpdate:
				newStorageKey !== row.s3StorageKey ||
				(row.progressStorageKey ?? null) !== (newProgressKey ?? null)
		};
	});
}

function buildCollisionGroups(plans) {
	const byNewKey = new Map();
	for (const plan of plans) {
		const existing = byNewKey.get(plan.newStorageKey) ?? [];
		existing.push(plan);
		byNewKey.set(plan.newStorageKey, existing);
	}
	return [...byNewKey.entries()].filter(([, items]) => items.length > 1);
}

function rankForKeep(a, b) {
	const aHasProgress = a.progressStorageKey ? 1 : 0;
	const bHasProgress = b.progressStorageKey ? 1 : 0;
	if (aHasProgress !== bHasProgress) {
		return bHasProgress - aHasProgress;
	}

	const aProgressUpdatedAt = parseDateValue(a.progressUpdatedAt);
	const bProgressUpdatedAt = parseDateValue(b.progressUpdatedAt);
	if (aProgressUpdatedAt !== bProgressUpdatedAt) {
		return bProgressUpdatedAt - aProgressUpdatedAt;
	}

	const aCreatedAt = parseDateValue(a.createdAt);
	const bCreatedAt = parseDateValue(b.createdAt);
	if (aCreatedAt !== bCreatedAt) {
		return bCreatedAt - aCreatedAt;
	}

	return b.id - a.id;
}

function buildDedupePlan(collisionGroups) {
	return collisionGroups.map(([sanitizedKey, items]) => {
		const sorted = [...items].sort(rankForKeep);
		return {
			sanitizedKey,
			keep: sorted[0],
			remove: sorted.slice(1)
		};
	});
}

async function applyDedupe(dedupePlan) {
	const removedRows = [];

	for (const group of dedupePlan) {
		for (const row of group.remove) {
			await db.execute({ sql: 'DELETE FROM Books WHERE id = ?', args: [row.id] });
			removedRows.push(row);
			console.log(`[dedupe:ok] removed id=${row.id} (kept id=${group.keep.id}) key=${group.sanitizedKey}`);
		}
	}

	const remainingRows = await fetchRows();
	const remainingBookKeys = new Set(remainingRows.map((row) => row.s3StorageKey));
	const remainingProgressKeys = new Set(
		remainingRows.map((row) => row.progressStorageKey).filter((value) => Boolean(value))
	);

	for (const row of removedRows) {
		if (!remainingBookKeys.has(row.s3StorageKey)) {
			await deleteObject(`library/${row.s3StorageKey}`).catch(() => {});
		}

		if (row.progressStorageKey && !remainingProgressKeys.has(row.progressStorageKey)) {
			await deleteObject(`library/${row.progressStorageKey}`).catch(() => {});
		}
	}
}

let rows = await fetchRows();
let plans = buildPlans(rows);
let collisions = buildCollisionGroups(plans);
let candidates = plans.filter((p) => p.needsUpdate);

console.log(`[backfill] Mode: ${dryRun ? 'dry-run' : 'apply'}`);
console.log(`[backfill] Dedupe mode: ${enableDedupe ? 'enabled' : 'disabled'}`);
console.log(`[backfill] Total books: ${plans.length}`);
console.log(`[backfill] Books needing update: ${candidates.length}`);
console.log(`[backfill] Collisions: ${collisions.length}`);

if (collisions.length > 0) {
	for (const [key, items] of collisions) {
		console.log(`[collision] key=${key} ids=${items.map((item) => item.id).join(',')}`);
	}

	if (!enableDedupe) {
		console.log('[backfill] Resolve collisions before apply. Exiting.');
		process.exit(1);
	}

	const dedupePlan = buildDedupePlan(collisions);
	for (const group of dedupePlan) {
		console.log(
			`[dedupe:plan] key=${group.sanitizedKey} keep=${group.keep.id} remove=${group.remove
				.map((row) => row.id)
				.join(',')}`
		);
	}

	if (dryRun) {
		console.log('[backfill] Dedupe dry-run complete. Re-run with --apply --dedupe to execute.');
		process.exit(0);
	}

	console.log('[backfill] Applying dedupe...');
	await applyDedupe(dedupePlan);

	rows = await fetchRows();
	plans = buildPlans(rows);
	collisions = buildCollisionGroups(plans);
	candidates = plans.filter((p) => p.needsUpdate);

	console.log(`[backfill] Post-dedupe books needing update: ${candidates.length}`);
	console.log(`[backfill] Post-dedupe collisions: ${collisions.length}`);
	if (collisions.length > 0) {
		console.log('[backfill] Collisions still exist after dedupe. Exiting.');
		process.exit(1);
	}
}

if (dryRun) {
	for (const plan of candidates) {
		console.log(
			`[plan] id=${plan.id} s3: "${plan.s3StorageKey}" -> "${plan.newStorageKey}"` +
				(plan.progressStorageKey
					? ` | progress: "${plan.progressStorageKey}" -> "${plan.newProgressKey}"`
					: '')
		);
	}
	process.exit(0);
}

let updated = 0;
let skipped = 0;
let failed = 0;

for (const plan of candidates) {
	const oldBookObject = `library/${plan.s3StorageKey}`;
	const newBookObject = `library/${plan.newStorageKey}`;
	const oldProgressObject = plan.progressStorageKey ? `library/${plan.progressStorageKey}` : null;
	const newProgressObject = plan.newProgressKey ? `library/${plan.newProgressKey}` : null;

	try {
		const sourceExists = await headObject(oldBookObject);
		if (!sourceExists) {
			console.log(`[skip] id=${plan.id} missing source object ${oldBookObject}`);
			skipped += 1;
			continue;
		}

		const targetExists = await headObject(newBookObject);
		if (!targetExists) {
			await copyObject(oldBookObject, newBookObject);
		}

		if (oldProgressObject && newProgressObject && oldProgressObject !== newProgressObject) {
			const oldProgressExists = await headObject(oldProgressObject);
			if (oldProgressExists) {
				const newProgressExists = await headObject(newProgressObject);
				if (!newProgressExists) {
					await copyObject(oldProgressObject, newProgressObject);
				}
			}
		}

		await db.execute({
			sql: `UPDATE Books SET s3_storage_key = ?, progress_storage_key = ? WHERE id = ?`,
			args: [plan.newStorageKey, plan.newProgressKey, plan.id]
		});

		if (oldBookObject !== newBookObject) {
			await deleteObject(oldBookObject).catch(() => {});
		}
		if (oldProgressObject && newProgressObject && oldProgressObject !== newProgressObject) {
			await deleteObject(oldProgressObject).catch(() => {});
		}

		console.log(`[ok] id=${plan.id} migrated to ${plan.newStorageKey}`);
		updated += 1;
	} catch (error) {
		console.error(
			`[fail] id=${plan.id} ${plan.s3StorageKey} -> ${plan.newStorageKey}: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
		failed += 1;
	}
}

console.log(`[backfill] Updated: ${updated}`);
console.log(`[backfill] Skipped: ${skipped}`);
console.log(`[backfill] Failed: ${failed}`);

if (failed > 0) {
	process.exit(1);
}
