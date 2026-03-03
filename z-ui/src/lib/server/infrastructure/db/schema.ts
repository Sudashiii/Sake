import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('Books', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	s3StorageKey: text('s3_storage_key').notNull(),
	title: text('title').notNull(),
	zLibId: text('zLibId'),
	author: text('author'),
	publisher: text('publisher'),
	series: text('series'),
	volume: text('volume'),
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

export const shelves = sqliteTable('Shelves', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	icon: text('icon').notNull().default('📚'),
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
