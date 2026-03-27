import { describe, it, expect } from 'vitest';
import { exportToMarkdown, exportToWordPress, sanitizeFilename } from '../../server/services/exportService';

describe('exportToMarkdown', () => {
  it('should return markdown content with correct filename', () => {
    const result = exportToMarkdown('# Test', 'テスト記事');
    expect(result.content).toBe('# Test');
    expect(result.filename).toBe('テスト記事.md');
    expect(result.mimeType).toBe('text/markdown');
  });
});

describe('exportToWordPress', () => {
  it('should convert headings to HTML', () => {
    const result = exportToWordPress('# Title\n\n## Section\n\n### Sub');
    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<h2>Section</h2>');
    expect(result).toContain('<h3>Sub</h3>');
  });

  it('should convert bold and italic', () => {
    const result = exportToWordPress('**bold** and *italic*');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
  });

  it('should convert image instructions to comments', () => {
    const result = exportToWordPress('[画像：ビジネスマン]');
    expect(result).toContain('<!-- 画像挿入: ビジネスマン -->');
  });

  it('should wrap plain text in <p> tags', () => {
    const result = exportToWordPress('This is a paragraph.');
    expect(result).toContain('<p>This is a paragraph.</p>');
  });
});

describe('sanitizeFilename', () => {
  it('should remove invalid characters', () => {
    expect(sanitizeFilename('test/file:name')).toBe('testfilename');
  });

  it('should replace spaces with underscores', () => {
    expect(sanitizeFilename('test file name')).toBe('test_file_name');
  });

  it('should truncate long names', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(100);
  });
});
