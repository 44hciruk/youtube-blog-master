import {
  transformToUserVoice,
  generateHistoricalBackground,
  generateSceneGuides,
  generateQA,
} from './llmService';
import type { DecorationStrength } from './llmService';

interface GenerationSettings {
  tone: string;
  decorationStrength: {
    history: DecorationStrength;
    qa: DecorationStrength;
    scenes: DecorationStrength;
  };
  articleLength: string;
  seoKeywords: string[];
}

interface VideoData {
  videoId: string;
  title: string;
  transcript: string;
  extractedKeywords: string[];
  mainPoints: string[];
}

interface GeneratedArticle {
  title: string;
  markdownContent: string;
  htmlContent: string;
  wordCount: number;
  metaDescription: string;
}

/**
 * Main article generation pipeline
 */
export async function generateArticle(
  videoData: VideoData,
  settings: GenerationSettings,
  openaiApiKey: string,
): Promise<GeneratedArticle> {
  // Step 1: Transform to user voice
  const transformed = await transformToUserVoice(
    videoData.transcript,
    settings.tone,
    openaiApiKey,
  );

  // Step 2: Generate decorations in parallel
  const [historicalBackground, sceneGuides, qaSection] = await Promise.all([
    generateHistoricalBackground(
      transformed.keyInsights,
      settings.decorationStrength.history,
      openaiApiKey,
    ),
    generateSceneGuides(
      transformed.coreKnowledge,
      settings.decorationStrength.scenes,
      openaiApiKey,
    ),
    generateQA(
      transformed.coreKnowledge,
      settings.decorationStrength.qa,
      openaiApiKey,
    ),
  ]);

  // Step 3: Compose the article with fixed 3-part structure
  const title = generateTitle(videoData.title, settings.seoKeywords);
  const markdown = composeMarkdown({
    title,
    coreKnowledge: transformed.coreKnowledge,
    keyInsights: transformed.keyInsights,
    historicalBackground,
    sceneGuides,
    qaSection,
    seoKeywords: settings.seoKeywords,
    articleLength: settings.articleLength,
  });

  const wordCount = countJapaneseWords(markdown);

  return {
    title,
    markdownContent: markdown,
    htmlContent: '', // Will be rendered on frontend
    wordCount,
    metaDescription: transformed.metaDescription,
  };
}

/**
 * Generate SEO-optimized title
 */
function generateTitle(originalTitle: string, seoKeywords: string[]): string {
  // Remove video-reference patterns from original title
  let title = originalTitle
    .replace(/【.*?】/g, '')
    .replace(/\[.*?\]/g, '')
    .trim();

  // If we have SEO keywords, try to incorporate them
  if (seoKeywords.length > 0) {
    const keywordsInTitle = seoKeywords.filter((kw) => title.includes(kw));
    if (keywordsInTitle.length === 0 && seoKeywords[0]) {
      title = `${seoKeywords[0]}：${title}`;
    }
  }

  return title;
}

/**
 * Compose full markdown article with fixed 3-part structure:
 * 1. 冒頭：結論・この記事でわかること
 * 2. 中盤：詳細解説（H2で2〜4セクション）
 * 3. 末尾：まとめ・読者へのアクション提案
 */
function composeMarkdown(data: {
  title: string;
  coreKnowledge: string;
  keyInsights: string[];
  historicalBackground: { topic: string; content: string }[];
  sceneGuides: { scene: string; guidance: string }[];
  qaSection: { question: string; answer: string }[];
  seoKeywords: string[];
  articleLength: string;
}): string {
  const sections: string[] = [];

  // ========================================
  // Part 1: 冒頭 — 結論・この記事でわかること
  // ========================================
  sections.push(`# ${data.title}\n`);

  // Lead paragraph: what readers will learn
  const introLength = data.articleLength === 'long' ? 3 : 2;
  const introSentences = data.coreKnowledge
    .split(/[。\n]/)
    .filter((s) => s.trim())
    .slice(0, introLength);
  sections.push(introSentences.join('。') + '。\n');

  // "What you'll learn" box
  if (data.keyInsights.length > 0) {
    sections.push(`**この記事でわかること：**\n`);
    for (const insight of data.keyInsights.slice(0, 5)) {
      sections.push(`- ${insight}`);
    }
    sections.push('');
  }

  // ========================================
  // Part 2: 中盤 — 詳細解説（H2で2〜4セクション）
  // ========================================

  // Core knowledge section
  sections.push(`## 押さえておくべきポイントとは\n`);
  sections.push(data.coreKnowledge + '\n');

  // Historical background
  if (data.historicalBackground.length > 0) {
    sections.push(`## 知っておきたい歴史的背景\n`);
    for (const bg of data.historicalBackground) {
      sections.push(`### ${bg.topic}\n`);
      sections.push(bg.content + '\n');
    }
  }

  // Scene guides
  if (data.sceneGuides.length > 0) {
    sections.push(`## シーン別の実践方法\n`);
    for (const guide of data.sceneGuides) {
      sections.push(`### ${guide.scene}\n`);
      sections.push(guide.guidance + '\n');
    }
  }

  // Q&A
  if (data.qaSection.length > 0) {
    sections.push(`## よくある疑問と回答\n`);
    for (const qa of data.qaSection) {
      sections.push(`### Q: ${qa.question}\n`);
      sections.push(`**A:** ${qa.answer}\n`);
    }
  }

  // ========================================
  // Part 3: 末尾 — まとめ・読者へのアクション提案
  // ========================================
  sections.push(`## まとめ\n`);
  const conclusionKeywords =
    data.seoKeywords.length > 0
      ? `${data.seoKeywords.slice(0, 3).join('、')}について`
      : 'これらのポイントについて';
  sections.push(
    `${conclusionKeywords}、今回ご紹介した内容を参考に、ぜひ実践してみてください。正しい知識を身につけることで、あなたの印象は大きく変わるはずです。\n`,
  );

  return sections.join('\n');
}

/**
 * Count characters in Japanese text (approximate word count)
 */
function countJapaneseWords(text: string): number {
  // Remove markdown syntax
  const cleaned = text
    .replace(/^#+\s/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\n/g, '');
  return cleaned.length;
}

export { composeMarkdown, countJapaneseWords, generateTitle };
