import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { saveUserApiKey, getUserApiKeys, getDecryptedApiKey } from '../helpers/apiKeys';
import { saveApiKeysSchema, apiKeyTypeSchema } from '../utils/validation';
import OpenAI from 'openai';

export const userRouter = router({
  // Save API keys
  saveApiKeys: protectedProcedure
    .input(saveApiKeysSchema)
    .mutation(async ({ ctx, input }) => {
      for (const { keyType, apiKey } of input.keys) {
        await saveUserApiKey(ctx.userId, keyType, apiKey);
      }
      return { success: true };
    }),

  // Get API keys (masked)
  getApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const keys = await getUserApiKeys(ctx.userId);
    return { keys };
  }),

  // Test API key connection
  testApiKey: protectedProcedure
    .input(z.object({ keyType: apiKeyTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getDecryptedApiKey(ctx.userId, input.keyType);
      if (!apiKey) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `${input.keyType} APIキーが設定されていません`,
        });
      }

      try {
        if (input.keyType === 'openai') {
          const openai = new OpenAI({ apiKey });
          await openai.models.list();
          return { success: true, message: 'OpenAI API接続成功' };
        }

        if (input.keyType === 'youtube') {
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${apiKey}`,
          );
          if (!res.ok) {
            throw new Error(`YouTube API returned ${res.status}`);
          }
          return { success: true, message: 'YouTube API接続成功' };
        }

        if (input.keyType === 'google') {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'test' }] }],
              }),
            },
          );
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const errorMsg = (errorData as Record<string, unknown>)?.error
              ? JSON.stringify((errorData as Record<string, unknown>).error)
              : `status ${res.status}`;
            throw new Error(`Google API Key が無効です: ${errorMsg}`);
          }
          return { success: true, message: 'Google API（Gemini）接続成功' };
        }

        return { success: false, message: '不明なキータイプ' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `API接続テスト失敗: ${message}`,
        });
      }
    }),
});
