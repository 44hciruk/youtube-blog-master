/**
 * In-memory progress store for article generation.
 * Keyed by `${userId}_${videoUrl}` or a generation ID.
 */

export type GenerationStep =
  | 'fetching_video'    // 動画情報を取得中...
  | 'fetching_transcript' // 字幕を取得中...
  | 'generating_article'  // AIが記事を生成中...
  | 'saving_article'      // 記事を保存中...
  | 'completed'
  | 'error';

interface ProgressEntry {
  step: GenerationStep;
  message: string;
  updatedAt: number;
}

const store = new Map<string, ProgressEntry>();

export function getProgressKey(userId: number): string {
  return `user_${userId}`;
}

export function setProgress(key: string, step: GenerationStep, message: string): void {
  store.set(key, { step, message, updatedAt: Date.now() });
}

export function getProgress(key: string): ProgressEntry | null {
  return store.get(key) || null;
}

export function clearProgress(key: string): void {
  store.delete(key);
}

// Clean up stale entries older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.updatedAt > 10 * 60 * 1000) {
      store.delete(key);
    }
  }
}, 60 * 1000);
