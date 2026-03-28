/**
 * Image Instruction Engine
 * Uses LLM to generate contextual image descriptions and insert them into articles
 */

import OpenAI from 'openai';

interface ImageInstruction {
  heading: string;
  description: string;
}

/**
 * Use LLM to generate contextual image descriptions for each ## heading,
 * then programmatically insert them into the markdown.
 */
export async function insertImageInstructionsWithLLM(
  markdownContent: string,
  openaiApiKey: string,
): Promise<string> {
  // Extract ## headings for the LLM to work with
  const lines = markdownContent.split('\n');
  const h2Headings: string[] = [];
  for (const line of lines) {
    if (/^## /.test(line)) {
      h2Headings.push(line.replace(/^## /, '').trim());
    }
  }

  if (h2Headings.length === 0) {
    return markdownContent;
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Ask LLM to generate only the image descriptions (not the full article)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `あなたは記事の画像指示を生成するエキスパートです。

与えられた記事の見出し一覧と記事本文を分析し、各見出しに対応する画像の説明文を生成してください。

【ルール】
- 各画像の説明文は、そのセクションの内容に対応した具体的なシーンの描写にすること
- 見出しのテキストをそのまま説明文にしないこと
- 各説明文はすべて異なる内容にすること
- 「まとめ」セクションにも適切な画像説明を付けること

【良い例】
見出し「リネン素材のシャツの魅力」→ 説明文「春の公園でリネンシャツを着た男性が歩いている爽やかなコーディネート」

【悪い例】
説明文「リネン素材のシャツの魅力」（見出しそのまま）
説明文「えっ！？まだこの春の無印見てないの！？」（煽り文句）

JSON配列で返してください。各要素は heading（見出しテキスト）と description（画像説明文）を含むこと。`,
      },
      {
        role: 'user',
        content: `## 見出し一覧：
${h2Headings.map((h, i) => `${i + 1}. ${h}`).join('\n')}

## 記事本文（参考用）：
${markdownContent.substring(0, 3000)}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'image_instructions',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  heading: { type: 'string', description: '見出しテキスト' },
                  description: { type: 'string', description: '画像の具体的なシーン描写' },
                },
                required: ['heading', 'description'],
                additionalProperties: false,
              },
            },
          },
          required: ['images'],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('LLM response was empty');

  const parsed = JSON.parse(content) as { images: ImageInstruction[] };

  // Build a map of heading → description
  const descriptionMap = new Map<string, string>();
  for (const img of parsed.images) {
    descriptionMap.set(img.heading, img.description);
  }

  // Programmatically insert image tags after each ## heading
  return insertImageTagsAfterHeadings(markdownContent, descriptionMap);
}

/**
 * Insert [画像：description] tags after ## headings using a description map
 */
function insertImageTagsAfterHeadings(
  markdownContent: string,
  descriptionMap: Map<string, string>,
): string {
  const lines = markdownContent.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result.push(line);

    if (/^## /.test(line)) {
      const heading = line.replace(/^## /, '').trim();

      // Check if next non-empty lines already have an image tag
      let hasImageAlready = false;
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (/^\[画像：.+\]$/.test(lines[j].trim())) {
          hasImageAlready = true;
          break;
        }
      }

      if (!hasImageAlready) {
        const description = descriptionMap.get(heading) || heading;
        result.push('');
        result.push(`[画像：${description}]`);
        result.push('');
      }
    }
  }

  return result.join('\n');
}

/**
 * Fallback: simple rule-based image instruction insertion (no LLM needed)
 */
export function insertImageInstructions(markdownContent: string): string {
  const lines = markdownContent.split('\n');
  const result: string[] = [];
  let imageCount = 0;
  const maxImages = 6;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result.push(line);

    if (/^## /.test(line) && imageCount < maxImages) {
      // Check if next non-empty line is already an image tag
      let hasImageAlready = false;
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (/^\[画像：.+\]$/.test(lines[j].trim())) {
          hasImageAlready = true;
          break;
        }
      }

      if (!hasImageAlready) {
        const heading = line.replace(/^## /, '').trim();
        result.push('');
        result.push(`[画像：${heading}]`);
        result.push('');
        imageCount++;
      }
    }
  }

  return result.join('\n');
}
