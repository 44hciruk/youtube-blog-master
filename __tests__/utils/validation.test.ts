import { describe, it, expect } from 'vitest';
import {
  extractVideoId,
  isValidYouTubeUrl,
  isValidOpenAiKey,
  isValidYouTubeApiKey,
} from '../../server/utils/validation';

describe('extractVideoId', () => {
  it('should extract ID from standard YouTube URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=hwgdBbkCu6Y')).toBe('hwgdBbkCu6Y');
  });

  it('should extract ID from YouTube Shorts URL', () => {
    expect(extractVideoId('https://youtube.com/shorts/lPXUbQyIOYQ?si=w0r1TnYlKFo7Axkz')).toBe('lPXUbQyIOYQ');
  });

  it('should extract ID from youtu.be short URL', () => {
    expect(extractVideoId('https://youtu.be/hwgdBbkCu6Y')).toBe('hwgdBbkCu6Y');
  });

  it('should return null for invalid URLs', () => {
    expect(extractVideoId('https://example.com')).toBeNull();
    expect(extractVideoId('not a url')).toBeNull();
    expect(extractVideoId('')).toBeNull();
  });
});

describe('isValidYouTubeUrl', () => {
  it('should validate correct YouTube URLs', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=hwgdBbkCu6Y')).toBe(true);
    expect(isValidYouTubeUrl('https://youtube.com/shorts/lPXUbQyIOYQ')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidYouTubeUrl('https://example.com')).toBe(false);
  });
});

describe('isValidOpenAiKey', () => {
  it('should validate correct OpenAI keys', () => {
    expect(isValidOpenAiKey('sk-abcdefghijklmnopqrstuvwxyz')).toBe(true);
  });

  it('should reject invalid keys', () => {
    expect(isValidOpenAiKey('not-a-key')).toBe(false);
    expect(isValidOpenAiKey('')).toBe(false);
  });
});

describe('isValidYouTubeApiKey', () => {
  it('should validate correct YouTube API keys', () => {
    expect(isValidYouTubeApiKey('AIzaSyB1234567890abcdefghijklmnopqrs')).toBe(true);
  });

  it('should reject invalid keys', () => {
    expect(isValidYouTubeApiKey('not-a-key')).toBe(false);
  });
});
