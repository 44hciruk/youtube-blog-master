import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  json,
  index,
  uniqueIndex,
  longtext,
} from 'drizzle-orm/mysql-core';

// Users テーブル（既存）
export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  openId: varchar('openId', { length: 64 }).unique().notNull(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: mysqlEnum('role', ['user', 'admin']).default('user'),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow(),
  lastSignedIn: timestamp('lastSignedIn').defaultNow(),
});

// UserApiKeys テーブル（新規）
export const userApiKeys = mysqlTable(
  'userApiKeys',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyType: mysqlEnum('keyType', ['openai', 'youtube']).notNull(),
    encryptedKey: text('encryptedKey').notNull(),
    createdAt: timestamp('createdAt').defaultNow(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex('userId_keyType_idx').on(table.userId, table.keyType),
    index('userApiKeys_userId_idx').on(table.userId),
  ],
);

// Articles テーブル（新規）
export const articles = mysqlTable(
  'articles',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    sourceVideoUrl: varchar('sourceVideoUrl', { length: 500 }).notNull(),
    sourceVideoId: varchar('sourceVideoId', { length: 50 }).notNull(),
    content: longtext('content').notNull(),
    markdownContent: longtext('markdownContent').notNull(),
    wordCount: int('wordCount'),
    status: mysqlEnum('status', ['draft', 'completed']).default('draft'),
    tone: varchar('tone', { length: 50 }),
    decorationStrength: json('decorationStrength'),
    articleLength: varchar('articleLength', { length: 50 }),
    seoKeywords: json('seoKeywords'),
    generatedAt: timestamp('generatedAt').defaultNow(),
    updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow(),
  },
  (table) => [
    index('articles_userId_videoId_idx').on(table.userId, table.sourceVideoId),
    index('articles_generatedAt_idx').on(table.generatedAt),
  ],
);

// Templates テーブル（新規）
export const templates = mysqlTable('templates', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  tone: varchar('tone', { length: 50 }),
  decorationStrength: json('decorationStrength'),
  articleLength: varchar('articleLength', { length: 50 }),
  seoKeywords: json('seoKeywords'),
  createdAt: timestamp('createdAt').defaultNow(),
});

// GenerationHistory テーブル（新規）
export const generationHistory = mysqlTable(
  'generationHistory',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoUrl: varchar('videoUrl', { length: 500 }).notNull(),
    videoId: varchar('videoId', { length: 50 }).notNull(),
    status: mysqlEnum('status', ['success', 'failed']).default('success'),
    errorMessage: text('errorMessage'),
    generatedAt: timestamp('generatedAt').defaultNow(),
  },
  (table) => [
    index('genHistory_userId_videoId_idx').on(table.userId, table.videoId),
  ],
);
