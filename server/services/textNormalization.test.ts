import { describe, it, expect } from 'vitest';
import { normalizeTranscript, extractKeywords, extractMainPoints } from './textNormalization';

describe('normalizeTranscript', () => {
  it('should remove timestamps', () => {
    expect(normalizeTranscript('Hello [00:01:23] world')).toBe('Hello world');
    expect(normalizeTranscript('Hello (1:23) world')).toBe('Hello world');
  });

  it('should remove speaker labels', () => {
    expect(normalizeTranscript('Speaker 1: Hello')).toBe('Hello');
    expect(normalizeTranscript('話者1：こんにちは')).toBe('こんにちは');
  });

  it('should remove Japanese filler words', () => {
    expect(normalizeTranscript('えーと、こんにちは')).toBe('こんにちは');
    expect(normalizeTranscript('あのー今日は')).toBe('今日は');
  });

  it('should normalize whitespace', () => {
    expect(normalizeTranscript('Hello   world    test')).toBe('Hello world test');
  });

  it('should normalize duplicate punctuation', () => {
    expect(normalizeTranscript('テスト、、テスト')).toBe('テスト、テスト');
    expect(normalizeTranscript('テスト。。テスト')).toBe('テスト。テスト');
  });
});

describe('extractKeywords', () => {
  it('should extract katakana keywords', () => {
    const text = 'スーツの着こなしマナーについて。スーツは重要です。ポケットフラップの使い方。';
    const keywords = extractKeywords(text);
    expect(keywords).toContain('スーツ');
    expect(keywords).toContain('ポケットフラップ');
  });

  it('should extract kanji keywords', () => {
    const text = '紳士服の基本。紳士服のマナーを学ぶ。紳士服の歴史。';
    const keywords = extractKeywords(text);
    expect(keywords).toContain('紳士服');
  });

  it('should respect maxKeywords limit', () => {
    const text = 'スーツ ジャケット パンツ シャツ ネクタイ ベスト コート ポケット ボタン カフス';
    const keywords = extractKeywords(text, 3);
    expect(keywords.length).toBeLessThanOrEqual(3);
  });
});

describe('extractMainPoints', () => {
  it('should extract main points from text', () => {
    const text = 'スーツの着こなしは重要です。ポケットフラップは外に出すことが大切です。ボタンは座る時に外してください。短い文。';
    const points = extractMainPoints(text, 3);
    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBeLessThanOrEqual(3);
  });

  it('should return empty array for empty text', () => {
    expect(extractMainPoints('')).toEqual([]);
  });

  it('should prefer assertive sentences', () => {
    const text = 'これは重要です。何か不明な点。ポイントは押さえてください。普通の文章が続きます。';
    const points = extractMainPoints(text, 2);
    expect(points.some((p) => p.includes('重要') || p.includes('ポイント'))).toBe(true);
  });
});
