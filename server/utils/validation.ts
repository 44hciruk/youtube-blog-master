import { z } from 'zod';

// YouTube URL patterns
const YOUTUBE_URL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/,
];

export function extractVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      // The video ID is in the last capture group
      return match[match.length - 1];
    }
  }
  return null;
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

export function isValidOpenAiKey(key: string): boolean {
  return /^sk-[a-zA-Z0-9_-]{20,}$/.test(key);
}

export function isValidYouTubeApiKey(key: string): boolean {
  return /^AIza[a-zA-Z0-9_-]{30,}$/.test(key);
}

// Zod schemas
export const youtubeUrlSchema = z.string().url().refine(isValidYouTubeUrl, {
  message: '無効なYouTube URLです',
});

export const apiKeyTypeSchema = z.enum(['openai', 'youtube', 'google']);

export const saveApiKeysSchema = z.object({
  keys: z.array(
    z.object({
      keyType: apiKeyTypeSchema,
      apiKey: z.string().min(1, 'APIキーを入力してください'),
    }),
  ),
});

export const toneSchema = z.enum(['professional_assertive', 'friendly_advisor']);

export const decorationStrengthSchema = z.object({
  history: z.enum(['weak', 'medium', 'strong']),
  qa: z.enum(['weak', 'medium', 'strong']),
  scenes: z.enum(['weak', 'medium', 'strong']),
});

export const articleLengthSchema = z.enum(['standard', 'long']);

export const generateArticleSchema = z.object({
  videoUrl: youtubeUrlSchema,
  tone: toneSchema.default('professional_assertive'),
  decorationStrength: decorationStrengthSchema.default({
    history: 'medium',
    qa: 'medium',
    scenes: 'medium',
  }),
  articleLength: articleLengthSchema.default('standard'),
  seoKeywords: z.array(z.string()).default([]),
  // Transcript fetched from browser (bypasses server-side bot detection)
  transcript: z.string().optional(),
});

export const updateArticleSchema = z.object({
  articleId: z.number(),
  title: z.string().optional(),
  markdownContent: z.string().optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'completed']).optional(),
});

export const templateSchema = z.object({
  name: z.string().min(1).max(100),
  tone: toneSchema.optional(),
  decorationStrength: decorationStrengthSchema.optional(),
  articleLength: articleLengthSchema.optional(),
  seoKeywords: z.array(z.string()).optional(),
});
