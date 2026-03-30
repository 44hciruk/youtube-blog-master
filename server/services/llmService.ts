import OpenAI from 'openai';

type DecorationStrength = 'weak' | 'medium' | 'strong';

interface TransformResult {
  coreKnowledge: string;
  keyInsights: string[];
  metaDescription: string;
}

interface HistoricalBackground {
  topic: string;
  content: string;
}

interface SceneGuide {
  scene: string;
  guidance: string;
}

interface QAItem {
  question: string;
  answer: string;
}

function getOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

function getStrengthInstruction(strength: DecorationStrength): string {
  switch (strength) {
    case 'weak':
      return '簡潔に、1段落程度で。';
    case 'medium':
      return '適度な詳細度で、2段落程度で。';
    case 'strong':
      return '詳細に、3段落以上で豊富な情報を含めて。';
  }
}

function getQACount(strength: DecorationStrength): number {
  switch (strength) {
    case 'weak': return 3;
    case 'medium': return 5;
    case 'strong': return 7;
  }
}

function getSceneCount(strength: DecorationStrength): number {
  switch (strength) {
    case 'weak': return 3;
    case 'medium': return 4;
    case 'strong': return 6;
  }
}

const ANTI_HALLUCINATION_RULE = `
【絶対厳守ルール】
- トランスクリプトに存在しない情報・数字・固有名詞は一切追加しないこと
- 不明な点は憶測で補完せず省略すること
- 「動画」「YouTube」「チャンネル」「この動画では」「紹介されていた」等の言及を完全に排除すること
- すべて筆者自身の実体験・知見として自然に語る文体にすること

【字幕テキストのノイズ除去】
- 字幕内の雑談、挨拶、チャンネル登録の促し、個人的なエピソード（旅行の話、日常の話など）はすべて無視すること
- 商品・アイテムに関する情報（商品名、価格、素材、着用感、サイズ感、おすすめポイント）のみを抽出して記事に反映すること
- 字幕に含まれる具体的な数値（価格、サイズ等）は正確に記事に反映すること
`;

const SEO_STRUCTURE_RULE = `
【SEO品質ルール】
- タイトルは読者が検索しそうな言葉を含める
- 冒頭200字で「この記事で何がわかるか」を明確にする
- H2見出しは「〜とは」「〜の方法」「〜のポイント」など検索意図に沿った形にする

【記事構成ガイドライン】
■ 基本構成：
# タイトル

導入文（3〜4文。この記事で何がわかるかを自然に説明）

**この記事でわかること：**
- ポイント1〜5

以降のセクション構成は、動画の内容に応じて最適な見出しと順序を自分で判断すること。
毎回同じテンプレートにしないこと。

■ 例えば以下のようなセクションが考えられる：
- 各アイテムの詳細レビュー
- コーディネート提案
- 素材や歴史に関するうんちく（動画で触れている場合）
- 使用シーンの提案
- よくある疑問と回答

動画の内容に合った構成を柔軟に組み立てること。

【禁止パターン】
- 「商談」「フォーマル」「カジュアル」「特別なイベント」の4分類シーン別セクションを毎回作る定型パターンは禁止
- 動画の内容と無関係な話題を含めないこと

【まとめセクションのルール】
- 記事で紹介した具体的なアイテム名を1〜2個挙げて振り返ること
- 読者が次に取るべき具体的なアクションを示すこと（例：「気になるアイテムは早めにチェックしてみてください」「オンラインストアで在庫を確認するのがおすすめです」等）
- 毎回異なる文章にすること
- 以下の表現は絶対に使用禁止：
  「正しい知識を身につけることで」
  「あなたの印象は大きく変わるはずです」
  「ぜひ実践してみてください」
  「今回ご紹介した内容を参考に」

【記事構成ルール】
- ## 見出し → [画像：見出しに関連する具体的な描写] → 本文 の順番を守ること
- 冒頭の導入文と「この記事でわかること」の間には画像を入れないこと

【画像タグのルール】
- 記事内に挿入する [画像：...] タグの説明文は、そのセクションの内容に対応した具体的な描写にすること
- タイトルをそのまま使わないこと
- 各画像タグの説明文はすべて異なる内容にすること。同じ説明文の画像タグを2つ以上作らないこと
- 良い例：[画像：ショートブルゾンを使ったカジュアルコーディネート例]
- 悪い例：[画像：ユニクロU新作マストバイ！これだけ買っておけば大丈夫！！！]
- 画像タグは各見出し（##）の直下に1つずつ配置すること
- 「この記事でわかること」リストの直後や、箇条書きの中間に画像タグを置かないこと
`;

/**
 * Transform transcript into user's own voice, removing all video references
 */
export async function transformToUserVoice(
  transcript: string,
  tone: string,
  apiKey: string,
): Promise<TransformResult> {
  const openai = getOpenAIClient(apiKey);

  const toneInstructions: Record<string, string> = {
    casual: '友達に話しかけるようなフランクな口調で書いてください。「〜だよね」「〜してみて」「〜なんだ」のような話し言葉を積極的に使ってください。敬語は使わないでください。',
    polite: 'です・ます調の丁寧な文体で書いてください。「〜です」「〜ます」「〜でしょう」を使い、読者に敬意を持った表現にしてください。',
    professional: '専門用語を多用し、である調で書いてください。「〜である」「〜といえる」「〜が求められる」のような硬い文体にしてください。読者は業界関係者を想定してください。',
  };
  const toneInstruction = toneInstructions[tone] || toneInstructions.polite;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `あなたは、トランスクリプトの内容を、筆者自身の知見として語り直すエキスパートです。

以下の処理を行ってください：
1. 「〇〇氏が言っている」「動画で紹介されていた」「チャンネルでは」などの参照表現をすべて削除
2. 知識そのものだけを抽出
3. 筆者が直接読者に語りかけるスタイルに変換（一人称で、断定的に）
4. ${toneInstruction}
5. 【絶対厳守】メタディスクリプションは必ず120〜160文字の範囲で生成すること。120文字未満や160文字超過は不可。検索結果に表示される要約文として、記事の内容が十分伝わる長さにすること

【重要：冒頭重複の防止】
- coreKnowledgeには詳細な解説本文のみを含めること
- 「この記事では〜を解説します」のような導入文はcoreKnowledgeに含めないこと
- keyInsightsはcoreKnowledgeの内容を繰り返さず、箇条書き用の簡潔なポイントにすること
- 冒頭の要約・導入はmetaDescriptionとkeyInsightsが担うため、coreKnowledgeでは繰り返さないこと

${ANTI_HALLUCINATION_RULE}
${SEO_STRUCTURE_RULE}`,
      },
      {
        role: 'user',
        content: `以下のトランスクリプトを変換してください：

${transcript}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'user_voice_transformation',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            coreKnowledge: {
              type: 'string',
              description: '筆者の知見として再構成された本文テキスト。冒頭の導入文・要約は含めず、詳細な解説のみを記述すること。',
            },
            keyInsights: {
              type: 'array',
              items: { type: 'string' },
              description: '抽出された主要なインサイト（5-10個）。本文(coreKnowledge)の内容と重複しない、簡潔な箇条書き用テキスト。',
            },
            metaDescription: {
              type: 'string',
              description: '【絶対厳守】120〜160文字のメタディスクリプション。120文字未満・160文字超過は不可。検索結果に表示される要約文。',
            },
          },
          required: ['coreKnowledge', 'keyInsights', 'metaDescription'],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('LLM response was empty');
  return JSON.parse(content);
}

/**
 * Generate historical background for key insights
 */
export async function generateHistoricalBackground(
  keyInsights: string[],
  strength: DecorationStrength,
  apiKey: string,
): Promise<HistoricalBackground[]> {
  const openai = getOpenAIClient(apiKey);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `あなたは歴史的背景の解説エキスパートです。

以下のキーインサイトに対して、関連する歴史的背景を生成してください：
- 起源や由来
- 歴史的人物の逸話
- 業界の変遷
- 各ディテールの歴史的意味

${getStrengthInstruction(strength)}

自然な読み物として、読者が「なるほど」と思える歴史的背景を提供してください。
H2見出しは「〜の歴史とは」「〜が生まれた背景」など検索意図に沿った形にしてください。

${ANTI_HALLUCINATION_RULE}`,
      },
      {
        role: 'user',
        content: `キーインサイト：\n${keyInsights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'historical_background',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            historicalBackground: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  topic: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['topic', 'content'],
                additionalProperties: false,
              },
            },
          },
          required: ['historicalBackground'],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('LLM response was empty');
  return JSON.parse(content).historicalBackground;
}

/**
 * Generate scene-specific guides
 */
export async function generateSceneGuides(
  coreKnowledge: string,
  strength: DecorationStrength,
  apiKey: string,
): Promise<SceneGuide[]> {
  const sceneCount = getSceneCount(strength);
  const openai = getOpenAIClient(apiKey);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `あなたは実践的なアドバイザーです。

以下の知識を、${sceneCount}つの異なるシーンに適用したガイドを生成してください。
シーン例：商談・重要な会議、フォーマルな場、カジュアルな場、日常、特別なイベント、デート

各シーンで具体的なアドバイスを、読者がすぐに実践できるように書いてください。
H2見出しは「〜の方法」「〜のポイント」など検索意図に沿った形にしてください。
${getStrengthInstruction(strength)}

${ANTI_HALLUCINATION_RULE}`,
      },
      {
        role: 'user',
        content: `知識：\n${coreKnowledge}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'scene_guides',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            sceneGuides: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  scene: { type: 'string' },
                  guidance: { type: 'string' },
                },
                required: ['scene', 'guidance'],
                additionalProperties: false,
              },
            },
          },
          required: ['sceneGuides'],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('LLM response was empty');
  return JSON.parse(content).sceneGuides;
}

/**
 * Generate Q&A section
 */
export async function generateQA(
  coreKnowledge: string,
  strength: DecorationStrength,
  apiKey: string,
): Promise<QAItem[]> {
  const qaCount = getQACount(strength);
  const openai = getOpenAIClient(apiKey);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `あなたはQ&Aエキスパートです。

以下の知識に基づいて、読者が抱きそうな疑問と回答を${qaCount}個生成してください：
- 実用的な疑問
- よくある誤解の訂正
- 応用的な質問

回答は具体的で実践的な内容にしてください。
質問は「〜とは？」「〜の方法は？」など検索されやすい形にしてください。
${getStrengthInstruction(strength)}

${ANTI_HALLUCINATION_RULE}`,
      },
      {
        role: 'user',
        content: `知識：\n${coreKnowledge}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'qa_section',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            qaSection: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' },
                },
                required: ['question', 'answer'],
                additionalProperties: false,
              },
            },
          },
          required: ['qaSection'],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('LLM response was empty');
  return JSON.parse(content).qaSection;
}

/**
 * Regenerate meta description with strict character count enforcement.
 * Retries up to maxRetries times if result is under 120 chars.
 */
export async function regenerateMetaDescription(
  articleContent: string,
  tone: string,
  apiKey: string,
  maxRetries = 2,
): Promise<string> {
  const openai = getOpenAIClient(apiKey);

  const toneLabels: Record<string, string> = {
    casual: 'カジュアルな口調',
    polite: '丁寧語（です・ます調）',
    professional: '専門的・である調',
  };
  const toneLabel = toneLabels[tone] || toneLabels.polite;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `あなたはSEOメタディスクリプション生成の専門家です。

【絶対厳守ルール】
- メタディスクリプションは必ず120〜160文字（日本語文字数）で生成すること
- 120文字未満は絶対に不可。必ず120文字以上にすること
- 160文字を超えてはならない
- 検索結果に表示される要約文として、記事の核心的な価値を伝えること
- ${toneLabel}で統一すること
- 「動画」「YouTube」「チャンネル」への言及は禁止

【品質基準】
- 読者が検索結果でクリックしたくなる文章にすること
- 記事の主要なベネフィットを含めること
- 具体的な情報（数字、方法名など）を含めること`,
        },
        {
          role: 'user',
          content: `以下の記事内容に基づいて、120〜160文字のメタディスクリプションを生成してください。

記事内容（冒頭部分）：
${articleContent.substring(0, 2000)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'meta_description',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              metaDescription: {
                type: 'string',
                description: '120〜160文字のメタディスクリプション。120文字未満は不可。',
              },
            },
            required: ['metaDescription'],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('LLM response was empty');

    const result = JSON.parse(content).metaDescription as string;

    // Check character count — if >= 120, accept it
    if (result.length >= 120) {
      return result;
    }

    console.log(`[MetaDescription] Attempt ${attempt + 1}: ${result.length} chars (< 120), retrying...`);
  }

  // If all retries fail, return the last result anyway
  const lastResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `メタディスクリプションを正確に140文字で生成してください。${toneLabel}で。`,
      },
      {
        role: 'user',
        content: `記事内容：\n${articleContent.substring(0, 1500)}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 300,
  });

  return lastResponse.choices[0].message.content?.trim() || '';
}

export type { TransformResult, HistoricalBackground, SceneGuide, QAItem, DecorationStrength };
