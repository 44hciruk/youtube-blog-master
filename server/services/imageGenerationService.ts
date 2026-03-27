import { GoogleGenAI, Modality } from '@google/genai';

export interface GeneratedImage {
  tag: string;
  base64: string;
}

/**
 * Detect all [画像：〇〇] tags in article markdown content
 */
export function detectImageTags(markdownContent: string): string[] {
  const pattern = /\[画像：([^\]]+)\]/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdownContent)) !== null) {
    tags.push(match[0]); // full tag e.g. [画像：スーツのポケットフラップ]
  }
  return tags;
}

/**
 * Extract the description text from a [画像：〇〇] tag
 */
function extractDescription(tag: string): string {
  const m = tag.match(/\[画像：([^\]]+)\]/);
  return m ? m[1] : tag;
}

/**
 * Generate a single image via Gemini API and return as Base64
 */
async function generateSingleImage(
  description: string,
  apiKey: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-preview-image-generation',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `高品質なブログ用写真を生成してください。テーマ：${description}。
スタイル：プロフェッショナル、明るい自然光、清潔感のある背景。
用途：日本のメンズファッション・スーツブログ記事のアイキャッチ画像。`,
          },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data) {
      // Return as data URI so the frontend can use it directly as <img src>
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error(`画像生成に失敗しました: ${description}`);
}

/**
 * Generate images for all [画像：〇〇] tags found in article content.
 * Returns an array of { tag, base64 } objects.
 * Tags that fail to generate are skipped with a console warning.
 */
export async function generateImagesForArticle(
  markdownContent: string,
  apiKey: string,
): Promise<GeneratedImage[]> {
  const tags = detectImageTags(markdownContent);

  if (tags.length === 0) {
    return [];
  }

  // Deduplicate tags to avoid paying twice for the same prompt
  const uniqueTags = [...new Set(tags)];

  const results: GeneratedImage[] = [];

  for (const tag of uniqueTags) {
    const description = extractDescription(tag);
    try {
      const base64 = await generateSingleImage(description, apiKey);
      results.push({ tag, base64 });
    } catch (err) {
      console.warn(`[imageGenerationService] Skipping tag "${tag}":`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}
