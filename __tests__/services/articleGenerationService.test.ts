import { describe, it, expect } from 'vitest';
import { composeMarkdown, countJapaneseWords, generateTitle } from '../../server/services/articleGenerationService';

describe('generateTitle', () => {
  it('should strip bracket markers from title', () => {
    expect(generateTitle('【必見】スーツの着こなし術', [])).toBe('スーツの着こなし術');
    expect(generateTitle('[Tips] Suit Style', [])).toBe('Suit Style');
  });

  it('should prepend SEO keyword if not present in title', () => {
    const title = generateTitle('着こなし術', ['スーツ', 'マナー']);
    expect(title).toContain('スーツ');
  });

  it('should not prepend keyword if already in title', () => {
    const title = generateTitle('スーツの着こなし術', ['スーツ']);
    expect(title).toBe('スーツの着こなし術');
  });
});

describe('countJapaneseWords', () => {
  it('should count characters excluding markdown syntax', () => {
    const text = '# タイトル\n\nこれはテストです。\n\n**太字**のテスト。';
    const count = countJapaneseWords(text);
    expect(count).toBeGreaterThan(0);
    // Should not include #, **, newlines
    expect(count).toBeLessThan(text.length);
  });
});

describe('composeMarkdown', () => {
  it('should compose a complete markdown article', () => {
    const result = composeMarkdown({
      title: 'テスト記事',
      coreKnowledge: 'これは重要な知識です。実践してください。',
      keyInsights: ['ポイント1', 'ポイント2'],
      historicalBackground: [
        { topic: '歴史1', content: '19世紀に始まった。' },
      ],
      sceneGuides: [
        { scene: '商談', guidance: 'ダークスーツを選びましょう。' },
      ],
      qaSection: [
        { question: 'ネクタイは必要？', answer: 'はい、基本的に必要です。' },
      ],
      seoKeywords: ['スーツ', 'ビジネス'],
      articleLength: 'standard',
    });

    expect(result).toContain('# テスト記事');
    expect(result).toContain('## 知っておくべきポイント');
    expect(result).toContain('## 歴史的背景');
    expect(result).toContain('## シーン別ガイド');
    expect(result).toContain('## よくある質問');
    expect(result).toContain('## まとめ');
    expect(result).toContain('- ポイント1');
    expect(result).toContain('### 商談');
    expect(result).toContain('Q: ネクタイは必要？');
  });
});
