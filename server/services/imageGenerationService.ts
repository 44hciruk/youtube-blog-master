import OpenAI from 'openai';

export interface GeneratedImage {
  tag: string;
  base64: string;
  prompt?: string;
}

export interface ImagePrompt {
  tag: string;
  description: string;
  englishPrompt: string;
}

/**
 * Detect all [画像：〇〇] tags in article markdown content
 */
export function detectImageTags(markdownContent: string): string[] {
  const pattern = /\[画像：([^\]]+)\]/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdownContent)) !== null) {
    tags.push(match[0]);
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
 * Generate English image prompt from Japanese description using OpenAI
 */
async function generateEnglishPrompt(
  description: string,
  articleTitle: string,
  openaiApiKey: string,
): Promise<string> {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `以下のブログ記事の画像説明を、画像生成AI用の英語プロンプトに変換してください。
ブログのSEO画像として適切な、具体的で視覚的な描写にしてください。
プロンプトのみを返してください。`,
      },
      {
        role: 'user',
        content: `記事タイトル: ${articleTitle}\n画像説明: ${description}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  return response.choices[0].message.content?.trim() || description;
}

/**
 * Generate English prompts for all image tags in article
 */
export async function generateImagePrompts(
  markdownContent: string,
  articleTitle: string,
  openaiApiKey: string,
): Promise<ImagePrompt[]> {
  const tags = detectImageTags(markdownContent);
  const uniqueTags = [...new Set(tags)];

  const results: ImagePrompt[] = [];

  for (const tag of uniqueTags) {
    const description = extractDescription(tag);
    try {
      const englishPrompt = await generateEnglishPrompt(description, articleTitle, openaiApiKey);
      results.push({ tag, description, englishPrompt });
    } catch (err) {
      console.warn(`[imageGenerationService] Prompt generation failed for "${tag}":`, err instanceof Error ? err.message : err);
      // Fallback: use description directly
      results.push({
        tag,
        description,
        englishPrompt: `Professional blog photo: ${description}. Style: clean, bright natural light, modern background.`,
      });
    }
  }

  return results;
}

/**
 * Generate a single image via Nano Banana 2 (gemini-3.1-flash-image-preview)
 */
async function generateSingleImage(
  englishPrompt: string,
  apiKey: string,
): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `Generate a blog illustration: ${englishPrompt}` },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = (errorData as Record<string, unknown>)?.error
      ? JSON.stringify((errorData as Record<string, unknown>).error)
      : `status ${res.status}`;
    throw new Error(`Nano Banana 2 API error: ${errorMsg}`);
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inline_data?: { data: string; mime_type: string };
          inlineData?: { data: string; mimeType: string };
        }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    // Handle both snake_case and camelCase response formats
    const inlineData = part.inline_data || part.inlineData;
    const mimeType = (part.inline_data?.mime_type || part.inlineData?.mimeType) ?? 'image/png';
    if (inlineData?.data) {
      return `data:${mimeType};base64,${inlineData.data}`;
    }
  }

  throw new Error('画像生成に失敗しました: レスポンスに画像データがありません');
}

/**
 * Generate images for all [画像：〇〇] tags found in article content.
 * First generates English prompts via OpenAI, then generates images via Nano Banana 2.
 */
export async function generateImagesForArticle(
  markdownContent: string,
  googleApiKey: string,
  openaiApiKey?: string,
  articleTitle?: string,
): Promise<GeneratedImage[]> {
  const tags = detectImageTags(markdownContent);

  if (tags.length === 0) {
    return [];
  }

  const uniqueTags = [...new Set(tags)];
  const results: GeneratedImage[] = [];

  for (const tag of uniqueTags) {
    const description = extractDescription(tag);

    // Generate English prompt
    let englishPrompt: string;
    if (openaiApiKey && articleTitle) {
      try {
        englishPrompt = await generateEnglishPrompt(description, articleTitle, openaiApiKey);
      } catch {
        englishPrompt = `Professional blog photo: ${description}. Style: clean, bright natural light, modern background.`;
      }
    } else {
      englishPrompt = `Professional blog photo: ${description}. Style: clean, bright natural light, modern background.`;
    }

    // Generate image
    try {
      const base64 = await generateSingleImage(englishPrompt, googleApiKey);
      results.push({ tag, base64, prompt: englishPrompt });
    } catch (err) {
      console.warn(`[imageGenerationService] Skipping tag "${tag}":`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}
