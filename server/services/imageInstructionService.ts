/**
 * Image Instruction Engine
 * Uses LLM to generate contextual image descriptions and insert them into articles
 */

import OpenAI from 'openai';

/**
 * Insert image instructions into markdown content using LLM
 * Generates contextually appropriate image descriptions for each ## section
 */
export async function insertImageInstructionsWithLLM(
  markdownContent: string,
  openaiApiKey: string,
): Promise<string> {
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `あなたは記事に画像タグを挿入するエキスパートです。

与えられたMarkdown記事を分析し、各 ## 見出しの直下に [画像：...] タグを挿入してください。

【ルール】
- 各画像タグの説明文は、そのセクションの内容に対応した具体的なシーンの描写にすること
- タイトルや見出しをそのまま説明文にしないこと
- 各画像タグの説明文はすべて異なる内容にすること
- 「この記事でわかること」リストの前後には画像タグを入れないこと
- 画像タグは各 ## 見出しの直下にのみ配置すること（## の次の行に空行を入れて画像タグ）
- 4〜6個の画像タグを挿入すること
- 既に [画像：...] タグがある行はそのまま残し、重複して挿入しないこと
- 記事の本文内容は一切変更しないこと。画像タグの挿入のみ行うこと

【良い例】
## リネン素材のシャツの魅力

[画像：春の公園でリネンシャツを着た男性が歩いている爽やかなコーディネート]

本文テキスト...

【悪い例】
[画像：えっ！？まだこの春の無印見てないの！？早く見ないと損するよ！！！！]
[画像：リネン素材のシャツの魅力]
[画像：まとめ]

記事全体をそのまま返してください（画像タグを挿入した状態で）。`,
      },
      {
        role: 'user',
        content: markdownContent,
      },
    ],
    temperature: 0.5,
    max_tokens: 8000,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('LLM response was empty');

  return content;
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

    // Skip if already has image tags nearby
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
