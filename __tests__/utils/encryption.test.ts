import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../../server/utils/encryption';

// Set a test encryption key
beforeAll(() => {
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
});

describe('encryption', () => {
  it('should encrypt and decrypt an API key correctly', () => {
    const originalKey = 'sk-test1234567890abcdef';
    const encrypted = encryptApiKey(originalKey);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(originalKey);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const originalKey = 'sk-test1234567890abcdef';
    const encrypted1 = encryptApiKey(originalKey);
    const encrypted2 = encryptApiKey(originalKey);
    expect(encrypted1).not.toBe(encrypted2);
    // But both should decrypt to the same value
    expect(decryptApiKey(encrypted1)).toBe(originalKey);
    expect(decryptApiKey(encrypted2)).toBe(originalKey);
  });

  it('should handle unicode characters', () => {
    const key = 'sk-テスト日本語キー123';
    const encrypted = encryptApiKey(key);
    expect(decryptApiKey(encrypted)).toBe(key);
  });
});

describe('maskApiKey', () => {
  it('should mask API keys correctly', () => {
    const key = 'sk-1234567890abcdef';
    const masked = maskApiKey(key);
    expect(masked).toBe('sk-12****...bcdef');
  });

  it('should return **** for short keys', () => {
    expect(maskApiKey('')).toBe('****');
    expect(maskApiKey('short')).toBe('****');
  });

  it('should handle 10-char boundary', () => {
    const key = '1234567890';
    const masked = maskApiKey(key);
    expect(masked).toBe('12345****...67890');
  });
});
