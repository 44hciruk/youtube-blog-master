import { eq, and, desc, sql } from 'drizzle-orm';
import { db, schema } from '../db';

interface CreateArticleData {
  userId: number;
  title: string;
  sourceVideoUrl: string;
  sourceVideoId: string;
  content: string;
  markdownContent: string;
  wordCount?: number;
  status?: 'draft' | 'completed';
  tone?: string;
  decorationStrength?: Record<string, string>;
  articleLength?: string;
  seoKeywords?: string[];
  metaDescription?: string;
}

interface UpdateArticleData {
  title?: string;
  content?: string;
  markdownContent?: string;
  wordCount?: number;
  status?: 'draft' | 'completed';
  images?: { tag: string; base64: string }[];
}

export async function createArticle(data: CreateArticleData) {
  const [result] = await db.insert(schema.articles).values({
    userId: data.userId,
    title: data.title,
    sourceVideoUrl: data.sourceVideoUrl,
    sourceVideoId: data.sourceVideoId,
    content: data.content,
    markdownContent: data.markdownContent,
    wordCount: data.wordCount,
    status: data.status || 'draft',
    tone: data.tone,
    decorationStrength: data.decorationStrength,
    articleLength: data.articleLength,
    seoKeywords: data.seoKeywords,
    metaDescription: data.metaDescription,
  }).returning({ id: schema.articles.id });

  return { articleId: result.id };
}

export async function getArticles(
  userId: number,
  limit = 20,
  offset = 0,
) {
  const articlesList = await db
    .select()
    .from(schema.articles)
    .where(eq(schema.articles.userId, userId))
    .orderBy(desc(schema.articles.generatedAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.articles)
    .where(eq(schema.articles.userId, userId));

  return {
    articles: articlesList,
    total: countResult.count,
    hasMore: offset + limit < countResult.count,
  };
}

export async function getArticleById(articleId: number, userId: number) {
  const [article] = await db
    .select()
    .from(schema.articles)
    .where(
      and(
        eq(schema.articles.id, articleId),
        eq(schema.articles.userId, userId),
      ),
    )
    .limit(1);

  return article || null;
}

export async function updateArticle(
  articleId: number,
  userId: number,
  data: UpdateArticleData,
) {
  await db
    .update(schema.articles)
    .set(data)
    .where(
      and(
        eq(schema.articles.id, articleId),
        eq(schema.articles.userId, userId),
      ),
    );

  return { articleId };
}

export async function deleteArticle(articleId: number, userId: number) {
  await db
    .delete(schema.articles)
    .where(
      and(
        eq(schema.articles.id, articleId),
        eq(schema.articles.userId, userId),
      ),
    );
}

export async function checkDuplicateVideo(userId: number, videoId: string) {
  const [existing] = await db
    .select({ id: schema.articles.id, title: schema.articles.title })
    .from(schema.articles)
    .where(
      and(
        eq(schema.articles.userId, userId),
        eq(schema.articles.sourceVideoId, videoId),
      ),
    )
    .limit(1);

  return existing
    ? { isDuplicate: true, existingArticleId: existing.id, existingArticleTitle: existing.title }
    : { isDuplicate: false };
}
