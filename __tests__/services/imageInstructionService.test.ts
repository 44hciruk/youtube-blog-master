import { describe, it, expect } from 'vitest';
import { identifyImagePoints, generateImageKeyword, insertImageInstructions } from '../../server/services/imageInstructionService';

const sampleMarkdown = `# スーツの着こなしマナー

スーツを正しく着こなすことは重要です。

## 知っておくべきポイント

ポケットフラップは外に出すことが基本です。

## 歴史的背景：なぜこのルールが生まれたのか

19世紀のイギリスで始まりました。

## シーン別ガイド

### 商談の場合

ダークスーツを選びましょう。

## よくある質問

### Q: ネクタイピンは必要？

基本的に必要です。

## まとめ

以上のポイントを実践してください。`;

describe('identifyImagePoints', () => {
  it('should identify image points after headings', () => {
    const points = identifyImagePoints(sampleMarkdown);
    expect(points.length).toBeGreaterThan(0);
  });

  it('should identify hero image after h1', () => {
    const points = identifyImagePoints(sampleMarkdown);
    const heroPoint = points.find((p) => p.context === 'hero');
    expect(heroPoint).toBeDefined();
  });

  it('should identify section images after h2', () => {
    const points = identifyImagePoints(sampleMarkdown);
    const sectionPoints = points.filter((p) => p.context === 'section');
    expect(sectionPoints.length).toBeGreaterThan(0);
  });
});

describe('generateImageKeyword', () => {
  it('should generate keyword for まとめ section', () => {
    expect(generateImageKeyword('## まとめ')).toBe('ビジネスマンのスーツ姿');
  });

  it('should generate keyword for 歴史的背景 section', () => {
    expect(generateImageKeyword('## 歴史的背景：なぜこのルール')).toBe('英国紳士 クラシックスーツ');
  });

  it('should return cleaned heading for unknown sections', () => {
    expect(generateImageKeyword('## ポケットフラップの使い方')).toBe('ポケットフラップの使い方');
  });
});

describe('insertImageInstructions', () => {
  it('should insert image instructions into markdown', () => {
    const result = insertImageInstructions(sampleMarkdown);
    expect(result).toContain('[画像：');
  });

  it('should preserve original content', () => {
    const result = insertImageInstructions(sampleMarkdown);
    expect(result).toContain('# スーツの着こなしマナー');
    expect(result).toContain('ポケットフラップは外に出すことが基本です。');
    expect(result).toContain('## まとめ');
  });
});
