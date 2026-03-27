import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Enums
export const roleEnum = pgEnum('role', ['user', 'admin']);
export const keyTypeEnum = pgEnum('key_type', ['openai', 'youtube', 'google']);
export const articleStatusEnum = pgEnum('article_status', ['draft', 'completed']);
export const historyStatusEnum = pgEnum('history_status', ['success', 'failed']);

// Users テーブル（既存）
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  openId: varchar('openId', { length: 64 }).unique().notNull(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: roleEnum('role').default('user'),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
  lastSignedIn: timestamp('lastSignedIn').defaultNow(),
});

// UserApiKeys テーブル
export const userApiKeys = pgTable(
  'userApiKeys',
  {
    id: serial('id').primaryKey(),
    userId: integer('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyType: keyTypeEnum('keyType').notNull(),
    encryptedKey: text('encryptedKey').notNull(),
    createdAt: timestamp('createdAt').defaultNow(),
    updatedAt: timestamp('updatedAt').defaultNow(),
  },
  (table) => [
    uniqueIndex('userId_keyType_idx').on(table.userId, table.keyType),
    index('userApiKeys_userId_idx').on(table.userId),
  ],
);

// Articles テーブル
export const articles = pgTable(
  'articles',
  {
    id: serial('id').primaryKey(),
    userId: integer('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    sourceVideoUrl: varchar('sourceVideoUrl', { length: 500 }).notNull(),
    sourceVideoId: varchar('sourceVideoId', { length: 50 }).notNull(),
    content: text('content').notNull(),
    markdownContent: text('markdownContent').notNull(),
    wordCount: integer('wordCount'),
    status: articleStatusEnum('status').default('draft'),
    tone: varchar('tone', { length: 50 }),
    decorationStrength: jsonb('decorationStrength'),
    articleLength: varchar('articleLength', { length: 50 }),
    seoKeywords: jsonb('seoKeywords'),
    images: jsonb('images'),
    generatedAt: timestamp('generatedAt').defaultNow(),
    updatedAt: timestamp('updatedAt').defaultNow(),
  },
  (table) => [
    index('articles_userId_videoId_idx').on(table.userId, table.sourceVideoId),
    index('articles_generatedAt_idx').on(table.generatedAt),
  ],
);

// Templates テーブル
export const templates = pgTable('templates', {
  id: serial('id').primaryKey(),
  userId: integer('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  tone: varchar('tone', { length: 50 }),
  decorationStrength: jsonb('decorationStrength'),
  articleLength: varchar('articleLength', { length: 50 }),
  seoKeywords: jsonb('seoKeywords'),
  createdAt: timestamp('createdAt').defaultNow(),
});

// GenerationHistory テーブル
export const generationHistory = pgTable(
  'generationHistory',
  {
    id: serial('id').primaryKey(),
    userId: integer('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoUrl: varchar('videoUrl', { length: 500 }).notNull(),
    videoId: varchar('videoId', { length: 50 }).notNull(),
    status: historyStatusEnum('status').default('success'),
    errorMessage: text('errorMessage'),
    generatedAt: timestamp('generatedAt').defaultNow(),
  },
  (table) => [
    index('genHistory_userId_videoId_idx').on(table.userId, table.videoId),
  ],
);
