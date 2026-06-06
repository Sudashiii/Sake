import { createClient } from '@libsql/client';
import { hashPassword } from '../../src/lib/server/application/services/LocalAuthService';
import { resolveLibsqlConfig } from '../../src/lib/server/config/infrastructure.shared.js';

type SqlArgument = string | number | boolean | null;

interface Statement {
	sql: string;
	args?: SqlArgument[];
}

interface CliOptions {
	count: number;
	batchSize: number;
	username: string;
	password: string;
}

interface BookSeed {
	id: number;
	s3StorageKey: string;
	title: string;
	author: string;
	publisher: string;
	series: string | null;
	volume: string | null;
	seriesIndex: number | null;
	edition: string | null;
	identifier: string;
	pages: number;
	description: string;
	externalRating: number;
	externalRatingCount: number;
	extension: string;
	filesize: number;
	language: string;
	year: number;
	month: number | null;
	day: number | null;
	progressStorageKey: string | null;
	progressUpdatedAt: string | null;
	progressPercent: number | null;
	progressBeforeRead: number | null;
	rating: number | null;
	readAt: string | null;
	archivedAt: string | null;
	excludeFromNewBooks: boolean;
	createdAt: string;
	deletedAt: string | null;
	trashExpiresAt: string | null;
}

interface ShelfSeed {
	id: number;
	name: string;
	icon: string;
	sortOrder: number;
	ruleGroupJson: string;
}

const DEFAULT_COUNT = 250;
const DEFAULT_BATCH_SIZE = 500;
const MAX_COUNT = 1_000_000;
const RESET_TABLES = [
	'BookShelves',
	'DeviceProgressDownloads',
	'DeviceDownloads',
	'BookProgressHistory',
	'QueueJobs',
	'Devices',
	'UserApiKeys',
	'UserSessions',
	'Shelves',
	'Books',
	'Users'
];

const CLASSIC_NOUNS = [
	'Archive',
	'Voyage',
	'Garden',
	'Signal',
	'Notebook',
	'Library',
	'Clock',
	'Map',
	'Harbor',
	'Field',
	'Lantern',
	'River'
];

const CLASSIC_MODIFIERS = [
	'Quiet',
	'Open',
	'Northern',
	'Patient',
	'Hidden',
	'Golden',
	'Restless',
	'Measured',
	'Bright',
	'Forgotten',
	'Common',
	'Late'
];

const AUTHORS = [
	'Mary Shelley',
	'Jane Austen',
	'Charles Dickens',
	'Louisa May Alcott',
	'Jules Verne',
	'Alexandre Dumas',
	'George Eliot',
	'Robert Louis Stevenson',
	'Edith Wharton',
	'Mark Twain',
	'Frances Hodgson Burnett',
	'Arthur Conan Doyle'
];

const PUBLISHERS = [
	'Public Domain Press',
	'Open Stacks Editions',
	'Commons Library',
	'Heritage Texts',
	'Free Shelf Works'
];

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it'];
const EXTENSIONS = ['epub', 'pdf', 'mobi'];

function printUsage(): void {
	console.log(`Usage: bun run demo:reset -- [count] [options]

Options:
  -n, --count, --entries <number>  Number of library books to seed (default: ${DEFAULT_COUNT})
  --batch-size <number>           Insert batch size (default: ${DEFAULT_BATCH_SIZE})
  --username <value>              Demo username (default: SAKE_DEMO_USERNAME or demo)
  --password <value>              Demo password (default: SAKE_DEMO_PASSWORD or demo-password)
  -h, --help                      Show this help text

Warning: this resets app data in the database configured by LIBSQL_URL.
`);
}

function parsePositiveInteger(value: string, optionName: string): number {
	if (!/^\d+$/.test(value)) {
		throw new Error(`${optionName} must be a positive integer`);
	}

	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`${optionName} must be a positive integer`);
	}

	return parsed;
}

function readOptionValue(args: string[], index: number, optionName: string): string {
	const value = args[index + 1];
	if (!value || value.startsWith('-')) {
		throw new Error(`${optionName} requires a value`);
	}
	return value;
}

function parseCliOptions(args: string[]): CliOptions {
	const options: CliOptions = {
		count: DEFAULT_COUNT,
		batchSize: DEFAULT_BATCH_SIZE,
		username: process.env.SAKE_DEMO_USERNAME?.trim() || 'demo',
		password: process.env.SAKE_DEMO_PASSWORD?.trim() || 'demo-password'
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '--count' || arg === '--entries' || arg === '-n') {
			const value = readOptionValue(args, index, arg);
			options.count = parsePositiveInteger(value, arg);
			index += 1;
			continue;
		}
		if (arg.startsWith('--count=')) {
			options.count = parsePositiveInteger(arg.slice('--count='.length), '--count');
			continue;
		}
		if (arg.startsWith('--entries=')) {
			options.count = parsePositiveInteger(arg.slice('--entries='.length), '--entries');
			continue;
		}
		if (arg === '--batch-size') {
			const value = readOptionValue(args, index, arg);
			options.batchSize = parsePositiveInteger(value, arg);
			index += 1;
			continue;
		}
		if (arg.startsWith('--batch-size=')) {
			options.batchSize = parsePositiveInteger(arg.slice('--batch-size='.length), '--batch-size');
			continue;
		}
		if (arg === '--username') {
			options.username = readOptionValue(args, index, arg).trim();
			index += 1;
			continue;
		}
		if (arg.startsWith('--username=')) {
			options.username = arg.slice('--username='.length).trim();
			continue;
		}
		if (arg === '--password') {
			options.password = readOptionValue(args, index, arg);
			index += 1;
			continue;
		}
		if (arg.startsWith('--password=')) {
			options.password = arg.slice('--password='.length);
			continue;
		}
		if (!arg.startsWith('-') && args.length === 1) {
			options.count = parsePositiveInteger(arg, 'count');
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (options.count > MAX_COUNT) {
		throw new Error(`--count cannot exceed ${MAX_COUNT.toLocaleString('en-US')}`);
	}
	if (options.batchSize > 5_000) {
		throw new Error('--batch-size cannot exceed 5000');
	}
	if (options.username.length < 3 || options.username.length > 64) {
		throw new Error('--username must be between 3 and 64 characters');
	}
	if (options.password.length < 8) {
		throw new Error('--password must be at least 8 characters');
	}

	return options;
}

function formatTarget(url: string): string {
	try {
		const parsed = new URL(url);
		if (parsed.protocol === 'file:') {
			return parsed.href;
		}
		return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
	} catch {
		return url;
	}
}

function isoDaysAgo(days: number): string {
	return new Date(Date.UTC(2026, 5, 5 - days, 12, 0, 0)).toISOString();
}

function isoDaysFromNow(days: number): string {
	return new Date(Date.UTC(2026, 5, 5 + days, 12, 0, 0)).toISOString();
}

function pick(values: string[], index: number): string {
	return values[index % values.length];
}

function buildTitle(index: number): string {
	const modifier = pick(CLASSIC_MODIFIERS, index);
	const noun = pick(CLASSIC_NOUNS, Math.floor(index / CLASSIC_MODIFIERS.length));
	const ordinal = String(index + 1).padStart(6, '0');
	return `${modifier} ${noun} ${ordinal}`;
}

function buildBookSeed(id: number): BookSeed {
	const index = id - 1;
	const title = buildTitle(index);
	const extension = pick(EXTENSIONS, index);
	const hasProgress = id % 3 !== 0;
	const progressPercent = hasProgress ? Number((((id % 97) + 1) / 100).toFixed(2)) : null;
	const isRead = progressPercent !== null && progressPercent >= 0.96;
	const archivedAt = id % 23 === 0 ? isoDaysAgo(id % 180) : null;
	const deletedAt = id % 41 === 0 ? isoDaysAgo(id % 21) : null;
	const seriesIndex = id % 5 === 0 ? (id % 12) + 1 : null;
	const year = 1810 + (id % 115);

	return {
		id,
		s3StorageKey: `demo/library/${String(id).padStart(7, '0')}.${extension}`,
		title,
		author: pick(AUTHORS, index),
		publisher: pick(PUBLISHERS, index),
		series: seriesIndex === null ? null : `${pick(CLASSIC_NOUNS, index)} Cycle`,
		volume: seriesIndex === null ? null : String(seriesIndex),
		seriesIndex,
		edition: id % 9 === 0 ? 'Illustrated public-domain edition' : null,
		identifier: `DEMO-${String(id).padStart(8, '0')}`,
		pages: 90 + (id % 720),
		description: `Generated demo library entry ${id.toLocaleString('en-US')} for Sake performance testing.`,
		externalRating: Number((3.1 + (id % 19) / 10).toFixed(1)),
		externalRatingCount: 25 + id * 3,
		extension,
		filesize: 180_000 + id * 1_337,
		language: pick(LANGUAGES, index),
		year,
		month: id % 4 === 0 ? ((id % 12) + 1) : null,
		day: id % 8 === 0 ? ((id % 27) + 1) : null,
		progressStorageKey: hasProgress ? `demo/progress/${String(id).padStart(7, '0')}.json` : null,
		progressUpdatedAt: hasProgress ? isoDaysAgo(id % 120) : null,
		progressPercent,
		progressBeforeRead: progressPercent === null ? null : Math.max(0, progressPercent - 0.08),
		rating: id % 6 === 0 ? (id % 5) + 1 : null,
		readAt: isRead ? isoDaysAgo(id % 90) : null,
		archivedAt,
		excludeFromNewBooks: id % 31 === 0,
		createdAt: isoDaysAgo(id % 365),
		deletedAt,
		trashExpiresAt: deletedAt ? isoDaysFromNow(30 + (id % 20)) : null
	};
}

function buildShelves(): ShelfSeed[] {
	return [
		{
			id: 1,
			name: 'Started',
			icon: 'bookmark',
			sortOrder: 0,
			ruleGroupJson:
				'{"id":"root","type":"group","connector":"AND","children":[{"id":"progress","type":"rule","field":"progress","operator":"gt","value":0}]}'
		},
		{
			id: 2,
			name: 'Classics',
			icon: 'library',
			sortOrder: 1,
			ruleGroupJson:
				'{"id":"root","type":"group","connector":"AND","children":[{"id":"publisher","type":"rule","field":"publisher","operator":"contains","value":"Public"}]}'
		},
		{
			id: 3,
			name: 'Long Reads',
			icon: 'book-open',
			sortOrder: 2,
			ruleGroupJson:
				'{"id":"root","type":"group","connector":"AND","children":[{"id":"pages","type":"rule","field":"pages","operator":"gte","value":500}]}'
		}
	];
}

function buildResetStatements(): Statement[] {
	return RESET_TABLES.map((table) => ({ sql: `DELETE FROM ${table}` }));
}

function buildUserStatement(username: string, passwordHash: string, nowIso: string): Statement {
	return {
		sql: `INSERT INTO Users (id, username, password_hash, is_disabled, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
		args: [1, username, passwordHash, false, nowIso, nowIso]
	};
}

function buildShelfStatement(shelf: ShelfSeed, nowIso: string): Statement {
	return {
		sql: `INSERT INTO Shelves (id, name, icon, sort_order, rule_group_json, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
		args: [shelf.id, shelf.name, shelf.icon, shelf.sortOrder, shelf.ruleGroupJson, nowIso, nowIso]
	};
}

function buildBookStatement(book: BookSeed): Statement {
	return {
		sql: `INSERT INTO Books (
			id,
			s3_storage_key,
			title,
			author,
			publisher,
			series,
			volume,
			series_index,
			edition,
			identifier,
			pages,
			description,
			external_rating,
			external_rating_count,
			extension,
			filesize,
			language,
			year,
			month,
			day,
			progress_storage_key,
			progress_updated_at,
			progress_percent,
			progress_before_read,
			rating,
			read_at,
			archived_at,
			exclude_from_new_books,
			createdAt,
			deleted_at,
			trash_expires_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			book.id,
			book.s3StorageKey,
			book.title,
			book.author,
			book.publisher,
			book.series,
			book.volume,
			book.seriesIndex,
			book.edition,
			book.identifier,
			book.pages,
			book.description,
			book.externalRating,
			book.externalRatingCount,
			book.extension,
			book.filesize,
			book.language,
			book.year,
			book.month,
			book.day,
			book.progressStorageKey,
			book.progressUpdatedAt,
			book.progressPercent,
			book.progressBeforeRead,
			book.rating,
			book.readAt,
			book.archivedAt,
			book.excludeFromNewBooks,
			book.createdAt,
			book.deletedAt,
			book.trashExpiresAt
		]
	};
}

function buildBookShelfStatements(book: BookSeed): Statement[] {
	const statements: Statement[] = [];
	if (book.progressPercent !== null && book.deletedAt === null) {
		statements.push({
			sql: 'INSERT INTO BookShelves (book_id, shelf_id, created_at) VALUES (?, ?, ?)',
			args: [book.id, 1, book.createdAt]
		});
	}
	if (book.publisher === 'Public Domain Press' && book.deletedAt === null) {
		statements.push({
			sql: 'INSERT INTO BookShelves (book_id, shelf_id, created_at) VALUES (?, ?, ?)',
			args: [book.id, 2, book.createdAt]
		});
	}
	if (book.pages >= 500 && book.deletedAt === null) {
		statements.push({
			sql: 'INSERT INTO BookShelves (book_id, shelf_id, created_at) VALUES (?, ?, ?)',
			args: [book.id, 3, book.createdAt]
		});
	}
	return statements;
}

function buildProgressHistoryStatements(book: BookSeed): Statement[] {
	if (book.progressPercent === null) {
		return [];
	}

	const firstProgress = Number(Math.max(0.01, book.progressPercent * 0.25).toFixed(2));
	const secondProgress = Number(Math.max(firstProgress, book.progressPercent * 0.65).toFixed(2));
	return [
		{
			sql: 'INSERT INTO BookProgressHistory (book_id, progress_percent, recorded_at) VALUES (?, ?, ?)',
			args: [book.id, firstProgress, isoDaysAgo((book.id % 120) + 14)]
		},
		{
			sql: 'INSERT INTO BookProgressHistory (book_id, progress_percent, recorded_at) VALUES (?, ?, ?)',
			args: [book.id, secondProgress, isoDaysAgo((book.id % 120) + 7)]
		},
		{
			sql: 'INSERT INTO BookProgressHistory (book_id, progress_percent, recorded_at) VALUES (?, ?, ?)',
			args: [book.id, book.progressPercent, book.progressUpdatedAt ?? book.createdAt]
		}
	];
}

function chunk<T>(values: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < values.length; index += size) {
		chunks.push(values.slice(index, index + size));
	}
	return chunks;
}

async function runBatch(
	client: ReturnType<typeof createClient>,
	statements: Statement[],
	batchSize: number
): Promise<void> {
	for (const group of chunk(statements, batchSize)) {
		await client.batch(group, 'write');
	}
}

async function main(): Promise<void> {
	const args = Bun.argv.slice(2);
	if (args.includes('--help') || args.includes('-h')) {
		printUsage();
		return;
	}

	const options = parseCliOptions(args);
	const libsql = resolveLibsqlConfig(process.env);
	const client = createClient({
		url: libsql.url,
		...(libsql.authToken ? { authToken: libsql.authToken } : {})
	});
	const nowIso = new Date().toISOString();
	const passwordHash = await hashPassword(options.password);
	const shelves = buildShelves();

	console.log(`[demo:reset] target=${formatTarget(libsql.url)}`);
	console.log(
		`[demo:reset] books=${options.count.toLocaleString('en-US')} batchSize=${options.batchSize}`
	);

	await runBatch(
		client,
		[...buildResetStatements(), buildUserStatement(options.username, passwordHash, nowIso)],
		options.batchSize
	);
	await runBatch(client, shelves.map((shelf) => buildShelfStatement(shelf, nowIso)), options.batchSize);

	for (let start = 1; start <= options.count; start += options.batchSize) {
		const end = Math.min(options.count, start + options.batchSize - 1);
		const statements: Statement[] = [];
		for (let id = start; id <= end; id += 1) {
			const book = buildBookSeed(id);
			statements.push(buildBookStatement(book));
			statements.push(...buildBookShelfStatements(book));
			statements.push(...buildProgressHistoryStatements(book));
		}
		await runBatch(client, statements, options.batchSize);
		const seeded = end.toLocaleString('en-US');
		const total = options.count.toLocaleString('en-US');
		console.log(`[demo:reset] seeded ${seeded}/${total} books`);
	}

	client.close();
	console.log(`[demo:reset] demo login username=${options.username}`);
	console.log('[demo:reset] done');
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
