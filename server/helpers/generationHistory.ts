import { eq } from 'drizzle-orm';
import { db, schema } from '../db';

export async function saveGenerationHistory(
  userId: number,
  videoUrl: string,
  videoId: string,
  status: 'success' | 'failed',
  errorMessage?: string,
) {
  await db.insert(schema.generationHistory).values({
    userId,
    videoUrl,
    videoId,
    status,
    errorMessage,
  });
}

export async function getGenerationHistory(userId: number) {
  return db
    .select()
    .from(schema.generationHistory)
    .where(eq(schema.generationHistory.userId, userId));
}
