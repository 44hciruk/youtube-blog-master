import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { db, schema } from '../db';

interface LogUsageData {
  userId: number;
  type: 'llm' | 'image';
  model: string;
  tokensUsed?: number;
  imageCount?: number;
  costEstimate?: string;
  articleId?: number;
}

export async function logUsage(data: LogUsageData) {
  try {
    await db.insert(schema.usageLogs).values({
      userId: data.userId,
      type: data.type,
      model: data.model,
      tokensUsed: data.tokensUsed,
      imageCount: data.imageCount,
      costEstimate: data.costEstimate,
      articleId: data.articleId,
    });
  } catch (err) {
    // Don't fail the main operation if logging fails
    console.warn('[usageLogs] Failed to log usage:', err instanceof Error ? err.message : err);
  }
}

interface UsageSummary {
  totalLlmCalls: number;
  totalImageCalls: number;
  totalLlmCost: number;
  totalImageCost: number;
  dailyBreakdown: {
    date: string;
    llmCalls: number;
    imageCalls: number;
    llmCost: number;
    imageCost: number;
  }[];
  articleBreakdown: {
    articleId: number;
    articleTitle: string;
    llmCalls: number;
    imageCalls: number;
    totalCost: number;
  }[];
}

export async function getUsageSummary(userId: number, daysBack = 30): Promise<UsageSummary> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  // Get all usage logs within the period
  const logs = await db
    .select()
    .from(schema.usageLogs)
    .where(
      and(
        eq(schema.usageLogs.userId, userId),
        gte(schema.usageLogs.createdAt, since),
      ),
    )
    .orderBy(desc(schema.usageLogs.createdAt));

  let totalLlmCalls = 0;
  let totalImageCalls = 0;
  let totalLlmCost = 0;
  let totalImageCost = 0;

  const dailyMap = new Map<string, { llmCalls: number; imageCalls: number; llmCost: number; imageCost: number }>();
  const articleMap = new Map<number, { llmCalls: number; imageCalls: number; totalCost: number }>();

  for (const log of logs) {
    const cost = parseFloat(log.costEstimate || '0');
    const dateKey = log.createdAt ? log.createdAt.toISOString().split('T')[0] : 'unknown';

    if (log.type === 'llm') {
      totalLlmCalls++;
      totalLlmCost += cost;
    } else {
      totalImageCalls += log.imageCount || 1;
      totalImageCost += cost;
    }

    // Daily breakdown
    const daily = dailyMap.get(dateKey) || { llmCalls: 0, imageCalls: 0, llmCost: 0, imageCost: 0 };
    if (log.type === 'llm') {
      daily.llmCalls++;
      daily.llmCost += cost;
    } else {
      daily.imageCalls += log.imageCount || 1;
      daily.imageCost += cost;
    }
    dailyMap.set(dateKey, daily);

    // Article breakdown
    if (log.articleId) {
      const article = articleMap.get(log.articleId) || { llmCalls: 0, imageCalls: 0, totalCost: 0 };
      if (log.type === 'llm') article.llmCalls++;
      else article.imageCalls += log.imageCount || 1;
      article.totalCost += cost;
      articleMap.set(log.articleId, article);
    }
  }

  // Get article titles for the breakdown
  const articleIds = Array.from(articleMap.keys());
  const articleTitles = new Map<number, string>();
  if (articleIds.length > 0) {
    const articles = await db
      .select({ id: schema.articles.id, title: schema.articles.title })
      .from(schema.articles)
      .where(
        and(
          eq(schema.articles.userId, userId),
          sql`${schema.articles.id} = ANY(${articleIds})`,
        ),
      );
    for (const a of articles) articleTitles.set(a.id, a.title);
  }

  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const articleBreakdown = Array.from(articleMap.entries())
    .map(([articleId, data]) => ({
      articleId,
      articleTitle: articleTitles.get(articleId) || `記事 #${articleId}`,
      ...data,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    totalLlmCalls,
    totalImageCalls,
    totalLlmCost: Math.round(totalLlmCost * 1000) / 1000,
    totalImageCost: Math.round(totalImageCost * 1000) / 1000,
    dailyBreakdown,
    articleBreakdown,
  };
}
