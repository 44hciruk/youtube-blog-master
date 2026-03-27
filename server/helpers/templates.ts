import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db';

interface SaveTemplateData {
  userId: number;
  name: string;
  tone?: string;
  decorationStrength?: Record<string, string>;
  articleLength?: string;
  seoKeywords?: string[];
}

export async function saveTemplate(data: SaveTemplateData) {
  const [result] = await db.insert(schema.templates).values({
    userId: data.userId,
    name: data.name,
    tone: data.tone,
    decorationStrength: data.decorationStrength,
    articleLength: data.articleLength,
    seoKeywords: data.seoKeywords,
  }).returning({ id: schema.templates.id });

  return { templateId: result.id };
}

export async function getTemplates(userId: number) {
  return db
    .select()
    .from(schema.templates)
    .where(eq(schema.templates.userId, userId));
}

export async function deleteTemplate(templateId: number, userId: number) {
  await db
    .delete(schema.templates)
    .where(
      and(
        eq(schema.templates.id, templateId),
        eq(schema.templates.userId, userId),
      ),
    );
}
