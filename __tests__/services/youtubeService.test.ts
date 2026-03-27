import { describe, it, expect } from 'vitest';
import { getVideoId, parseDuration, parseTranscriptXml, decodeXmlEntities } from '../../server/services/youtubeService';

describe('getVideoId', () => {
  it('should extract ID from standard URL', () => {
    expect(getVideoId('https://www.youtube.com/watch?v=hwgdBbkCu6Y')).toBe('hwgdBbkCu6Y');
  });

  it('should extract ID from shorts URL', () => {
    expect(getVideoId('https://youtube.com/shorts/lPXUbQyIOYQ?si=abc')).toBe('lPXUbQyIOYQ');
  });

  it('should extract ID from youtu.be URL', () => {
    expect(getVideoId('https://youtu.be/hwgdBbkCu6Y')).toBe('hwgdBbkCu6Y');
  });

  it('should throw for invalid URL', () => {
    expect(() => getVideoId('https://example.com')).toThrow('無効なYouTube URL');
  });
});

describe('parseDuration', () => {
  it('should parse hours, minutes, seconds', () => {
    expect(parseDuration('PT1H2M3S')).toBe(3723);
  });

  it('should parse minutes and seconds only', () => {
    expect(parseDuration('PT5M30S')).toBe(330);
  });

  it('should parse seconds only', () => {
    expect(parseDuration('PT45S')).toBe(45);
  });

  it('should return 0 for invalid duration', () => {
    expect(parseDuration('')).toBe(0);
  });
});

describe('parseTranscriptXml', () => {
  it('should parse transcript XML correctly', () => {
    const xml = `
      <transcript>
        <text start="0.0" dur="2.5">Hello world</text>
        <text start="2.5" dur="3.0">This is a test</text>
      </transcript>
    `;
    const segments = parseTranscriptXml(xml);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ text: 'Hello world', start: 0, duration: 2.5 });
    expect(segments[1]).toEqual({ text: 'This is a test', start: 2.5, duration: 3 });
  });

  it('should decode XML entities', () => {
    const xml = `<text start="0" dur="1">&amp; &lt; &gt; &quot;</text>`;
    const segments = parseTranscriptXml(xml);
    expect(segments[0].text).toBe('& < > "');
  });
});

describe('decodeXmlEntities', () => {
  it('should decode all entities', () => {
    expect(decodeXmlEntities('&amp; &lt; &gt; &quot; &#39;')).toBe('& < > " \'');
  });

  it('should strip HTML tags', () => {
    expect(decodeXmlEntities('Hello <b>world</b>')).toBe('Hello world');
  });
});
