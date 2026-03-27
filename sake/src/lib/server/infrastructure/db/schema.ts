import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('Books', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	s3StorageKey: text('s3_storage_key').notNull(),
	title: text('title').notNull(),
	zLibId: text('zLibId'),
	author: text('author'),
	publisher: text('publisher'),
	series: text('series'),
	volume: text('volume'),
	seriesIndex: real('series_index'),
	edition: text('edition'),
	identifier: text('identifier'),
	pages: integer('pages'),
	description: text('description'),
	googleBooksId: text('google_books_id'),
	openLibraryKey: text('open_library_key'),
	amazonAsin: text('amazon_asin'),
	externalRating: real('external_rating'),
	externalRatingCount: integer('external_rating_count'),
	externalReviewsJson: text('external_reviews_json'),
	cover: text('cover'),
	extension: text('extension'),
	filesize: integer('filesize'),
	language: text('language'),
	year: integer('year'),
	progressStorageKey: text('progress_storage_key'),
	progressUpdatedAt: text('progress_updated_at'),
	progressPercent: real('progress_percent'),
	progressBeforeRead: real('progress_before_read'),
	rating: integer('rating'),
	readAt: text('read_at'),
	archivedAt: text('archived_at'),
	excludeFromNewBooks: integer('exclude_from_new_books', { mode: 'boolean' }).notNull().default(false),
	createdAt: text('createdAt'),
	deletedAt: text('deleted_at'),
	trashExpiresAt: text('trash_expires_at')
});

export const pluginReleases = sqliteTable(
	'PluginReleases',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		version: text('version').notNull(),
		fileName: text('file_name').notNull(),
		storageKey: text('storage_key').notNull(),
		sha256: text('sha256').notNull(),
		isLatest: integer('is_latest', { mode: 'boolean' }).notNull().default(false),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [uniqueIndex('plugin_releases_version_unique').on(table.version)]
);

export const users = sqliteTable(
	'Users',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		username: text('username').notNull(),
		passwordHash: text('password_hash').notNull(),
		isDisabled: integer('is_disabled', { mode: 'boolean' }).notNull().default(false),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		lastLoginAt: text('last_login_at')
	},
	(table) => [uniqueIndex('users_username_unique').on(table.username)]
);

export const userSessions = sqliteTable(
	'UserSessions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull(),
		createdAt: text('created_at').notNull(),
		lastUsedAt: text('last_used_at').notNull(),
		expiresAt: text('expires_at').notNull(),
		revokedAt: text('revoked_at'),
		userAgent: text('user_agent'),
		ipAddress: text('ip_address')
	},
	(table) => [
		uniqueIndex('user_sessions_token_hash_unique').on(table.tokenHash),
		index('user_sessions_user_idx').on(table.userId),
		index('user_sessions_expires_idx').on(table.expiresAt)
	]
);

export const userApiKeys = sqliteTable(
	'UserApiKeys',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		deviceId: text('device_id').notNull(),
		scope: text('scope').notNull().default('device'),
		keyPrefix: text('key_prefix').notNull(),
		keyHash: text('key_hash').notNull(),
		createdAt: text('created_at').notNull(),
		lastUsedAt: text('last_used_at'),
		expiresAt: text('expires_at'),
		revokedAt: text('revoked_at')
	},
	(table) => [
		uniqueIndex('user_api_keys_key_hash_unique').on(table.keyHash),
		index('user_api_keys_user_idx').on(table.userId),
		index('user_api_keys_device_idx').on(table.deviceId)
	]
);

export const devices = sqliteTable(
	'Devices',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		deviceId: text('device_id').notNull(),
		pluginVersion: text('plugin_version').notNull(),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		lastSeenAt: text('last_seen_at').notNull()
	},
	(table) => [
		index('devices_user_idx').on(table.userId),
		uniqueIndex('devices_user_device_unique').on(table.userId, table.deviceId),
		uniqueIndex('devices_device_id_unique').on(table.deviceId)
	]
);

export const deviceDownloads = sqliteTable('DeviceDownloads', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	deviceId: text('deviceId').notNull(),
	bookId: integer('bookId')
		.notNull()
		.references(() => books.id, { onDelete: 'cascade' })
});

export const deviceProgressDownloads = sqliteTable(
	'DeviceProgressDownloads',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		deviceId: text('deviceId').notNull(),
		bookId: integer('bookId')
			.notNull()
			.references(() => books.id, { onDelete: 'cascade' }),
		progressUpdatedAt: text('progress_updated_at').notNull()
	},
	(table) => [
		uniqueIndex('device_progress_downloads_device_book_unique').on(table.deviceId, table.bookId)
	]
);

export const bookProgressHistory = sqliteTable(
	'BookProgressHistory',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		bookId: integer('book_id')
			.notNull()
			.references(() => books.id, { onDelete: 'cascade' }),
		progressPercent: real('progress_percent').notNull(),
		recordedAt: text('recorded_at').notNull()
	},
	(table) => [uniqueIndex('book_progress_history_book_recorded_unique').on(table.bookId, table.recordedAt)]
);

export const queueJobs = sqliteTable(
	'QueueJobs',
	{
		id: text('id').primaryKey(),
		bookId: text('book_id').notNull(),
		hash: text('hash').notNull(),
		title: text('title').notNull(),
		extension: text('extension').notNull(),
		author: text('author'),
		publisher: text('publisher'),
		series: text('series'),
		volume: text('volume'),
		seriesIndex: real('series_index'),
		edition: text('edition'),
		identifier: text('identifier'),
		pages: integer('pages'),
		description: text('description'),
		cover: text('cover'),
		filesize: integer('filesize'),
		language: text('language'),
		year: integer('year'),
		userId: text('user_id').notNull(),
		userKey: text('user_key').notNull(),
		status: text('status', {
			enum: ['queued', 'processing', 'completed', 'failed']
		}).notNull(),
		attempts: integer('attempts').notNull().default(0),
		maxAttempts: integer('max_attempts').notNull().default(3),
		error: text('error'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull(),
		finishedAt: text('finished_at')
	},
	(table) => [
		index('queue_jobs_status_updated_idx').on(table.status, table.updatedAt),
		index('queue_jobs_created_idx').on(table.createdAt)
	]
);

export const shelves = sqliteTable('Shelves', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	icon: text('icon').notNull().default('📚'),
	sortOrder: integer('sort_order').notNull().default(0),
	ruleGroupJson: text('rule_group_json')
		.notNull()
		.default('{"id":"root","type":"group","connector":"AND","children":[]}'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const bookShelves = sqliteTable(
	'BookShelves',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		bookId: integer('book_id')
			.notNull()
			.references(() => books.id, { onDelete: 'cascade' }),
		shelfId: integer('shelf_id')
			.notNull()
			.references(() => shelves.id, { onDelete: 'cascade' }),
		createdAt: text('created_at').notNull()
	},
	(table) => [uniqueIndex('book_shelves_book_shelf_unique').on(table.bookId, table.shelfId)]
);
