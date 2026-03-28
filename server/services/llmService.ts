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
`;

const SEO_STRUCTURE_RULE = `
【SEO品質ルール】
- タイトルは読者が検索しそうな言葉を含める
- 冒頭200字で「この記事で何がわかるか」を明確にする
- H2見出しは「〜とは」「〜の方法」「〜のポイント」など検索意図に沿った形にする

【記事構成（必ずこの3部構成を守ること）】
1. 冒頭：結論・この記事でわかること
2. 中盤：詳細解説（H2で2〜4セクション）
3. 末尾：まとめ・読者へのアクション提案
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

  const toneInstruction =
    tone === 'professional_assertive'
      ? 'より強い表現、確信を持った断定的な言い方で。プロフェッショナルな権威を持って語る。'
      : '柔らかい表現、読者への寄り添いを感じさせる親しみやすいアドバイザーとして語る。';

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
5. 100文字程度のメタディスクリプション（検索結果に表示される要約文）を生成

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
              description: '100文字程度のメタディスクリプション。検索結果に表示される要約文。',
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

export type { TransformResult, HistoricalBackground, SceneGuide, QAItem, DecorationStrength };
