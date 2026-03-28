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
 * Generate a single image via Imagen 3.0 API and return as Base64 data URI
 */
async function generateSingleImage(
  description: string,
  apiKey: string,
): Promise<string> {
  const prompt = `高品質なブログ用写真を生成してください。テーマ：${description}。スタイル：プロフェッショナル、明るい自然光、清潔感のある背景。用途：日本のメンズファッション・スーツブログ記事のアイキャッチ画像。`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1 },
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = (errorData as Record<string, unknown>)?.error
      ? JSON.stringify((errorData as Record<string, unknown>).error)
      : `status ${res.status}`;
    throw new Error(`Imagen API error: ${errorMsg}`);
  }

  const data = await res.json() as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };

  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error(`画像生成に失敗しました: ${description}`);
  }

  const mimeType = prediction.mimeType || 'image/png';
  return `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
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
