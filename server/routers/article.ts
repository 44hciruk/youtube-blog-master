import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { getDecryptedApiKey } from '../helpers/apiKeys';
import { createArticle, getArticles, getArticleById, updateArticle, deleteArticle, checkDuplicateVideo } from '../helpers/articles';
import { saveGenerationHistory } from '../helpers/generationHistory';
import { getVideoId, getVideoMetadata, getVideoTranscript } from '../services/youtubeService';
import { normalizeTranscript, extractKeywords, extractMainPoints } from '../services/textNormalization';
import { generateArticle } from '../services/articleGenerationService';
import { insertImageInstructions, insertImageInstructionsWithLLM } from '../services/imageInstructionService';
import { generateImagesForArticle, generateImagePrompts, generateSingleImageForTag } from '../services/imageGenerationService';
import { exportToMarkdown, exportToWordPress } from '../services/exportService';
import { generateArticleSchema, updateArticleSchema } from '../utils/validation';
import { getProgressKey, setProgress, getProgress, clearProgress } from '../services/progressStore';
import { logUsage } from '../helpers/usageLogs';

/**
 * Translate common errors into Japanese user-friendly messages
 */
function translateError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  // API key issues
  if (msg.includes('Incorrect API key') || msg.includes('invalid_api_key') || msg.includes('401')) {
    return 'APIキーが無効です。API設定画面で正しいキーを入力してください。';
  }

  // Quota exceeded
  if (msg.includes('quota') || msg.includes('rate_limit') || msg.includes('429') || msg.includes('insufficient_quota')) {
    return 'OpenAIのAPIクォータを超過しました。プランの確認またはしばらく待ってから再試行してください。';
  }

  // Video not found / private
  if (msg.includes('video not found') || msg.includes('private') || msg.includes('404') || msg.includes('videoNotFound')) {
    return '動画が見つかりません。非公開または削除された動画の可能性があります。';
  }

  // Transcript not available
  if (msg.includes('TRANSCRIPT_NOT_AVAILABLE') || msg.includes('subtitles') || msg.includes('caption')) {
    return 'この動画の字幕を取得できませんでした。字幕が無効になっている可能性があります。';
  }

  // Network errors
  if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND') || msg.includes('fetch failed') || msg.includes('network')) {
    return 'ネットワークエラーが発生しました。インターネット接続を確認してから再試行してください。';
  }

  return msg;
}

export const articleRouter = router({
  // Generate article from YouTube video
  generate: protectedProcedure
    .input(generateArticleSchema)
    .mutation(async ({ ctx, input }) => {
      const progressKey = getProgressKey(ctx.userId);

      // Check API keys
      const [openaiApiKey, youtubeApiKey] = await Promise.all([
        getDecryptedApiKey(ctx.userId, 'openai'),
        getDecryptedApiKey(ctx.userId, 'youtube'),
      ]);

      if (!openaiApiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'OpenAI APIキーが設定されていません。API設定画面から設定してください。',
        });
      }
      if (!youtubeApiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'YouTube APIキーが設定されていません。API設定画面から設定してください。',
        });
      }

      const videoId = getVideoId(input.videoUrl);

      try {
        // Step 1: Fetch video metadata
        setProgress(progressKey, 'fetching_video', '動画情報を取得中...');
        const metadata = await getVideoMetadata(videoId, youtubeApiKey);

        // Step 2: Get transcript (prefer browser-provided, fallback to server-side, then metadata)
        let normalizedTranscript: string;
        let extractedKeywords: string[];
        let mainPoints: string[];

        if (input.transcript && input.transcript.length > 100) {
          // Use transcript provided by browser (bypasses bot detection)
          setProgress(progressKey, 'fetching_transcript', 'ブラウザ経由の字幕を処理中...');
          console.log(`[Article] Using browser-provided transcript: ${input.transcript.length} chars`);
          normalizedTranscript = normalizeTranscript(input.transcript);
          extractedKeywords = extractKeywords(normalizedTranscript);
          mainPoints = extractMainPoints(normalizedTranscript);
        } else {
          // Try server-side transcript fetch
          setProgress(progressKey, 'fetching_transcript', '字幕を取得中...');
          try {
            const transcriptResult = await getVideoTranscript(videoId, youtubeApiKey);
            normalizedTranscript = normalizeTranscript(transcriptResult.transcript);
            extractedKeywords = extractKeywords(normalizedTranscript);
            mainPoints = extractMainPoints(normalizedTranscript);
          } catch (transcriptError) {
            // Final fallback: generate from metadata (title + description)
            console.log('[Article] All transcript methods failed, using metadata-based generation');
            setProgress(progressKey, 'fetching_transcript', 'メタデータベースで生成します...');
            normalizedTranscript = `${metadata.title}。${metadata.description}`;
            extractedKeywords = extractKeywords(normalizedTranscript);
            mainPoints = extractMainPoints(normalizedTranscript);
          }
        }

        // Step 3: Generate article with AI
        setProgress(progressKey, 'generating_article', 'AIが記事を生成中...');
        const generated = await generateArticle(
          {
            videoId,
            title: metadata.title,
            transcript: normalizedTranscript,
            extractedKeywords,
            mainPoints,
          },
          {
            tone: input.tone,
            decorationStrength: input.decorationStrength,
            articleLength: input.articleLength,
            seoKeywords: input.seoKeywords,
          },
          openaiApiKey,
        );

        // Step 4: Save to database
        setProgress(progressKey, 'saving_article', '記事を保存中...');
        const { articleId } = await createArticle({
          userId: ctx.userId,
          title: generated.title,
          sourceVideoUrl: input.videoUrl,
          sourceVideoId: videoId,
          content: generated.htmlContent,
          markdownContent: generated.markdownContent,
          wordCount: generated.wordCount,
          status: 'draft',
          tone: input.tone,
          decorationStrength: input.decorationStrength,
          articleLength: input.articleLength,
          seoKeywords: input.seoKeywords,
          metaDescription: generated.metaDescription,
        });

        // Save generation history
        await saveGenerationHistory(ctx.userId, input.videoUrl, videoId, 'success');

        // Log usage (4 LLM calls: transformToUserVoice + 3 parallel decorations)
        await logUsage({
          userId: ctx.userId,
          type: 'llm',
          model: 'gpt-4o',
          tokensUsed: generated.wordCount ? generated.wordCount * 2 : undefined,
          costEstimate: '0.05',
          articleId,
        });

        setProgress(progressKey, 'completed', '完了');
        // Clear after a brief delay so frontend can read 'completed'
        setTimeout(() => clearProgress(progressKey), 5000);

        return {
          articleId,
          title: generated.title,
          markdownContent: generated.markdownContent,
          wordCount: generated.wordCount,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        setProgress(progressKey, 'error', translateError(error));
        setTimeout(() => clearProgress(progressKey), 10000);

        // Save failed history
        await saveGenerationHistory(
          ctx.userId,
          input.videoUrl,
          videoId,
          'failed',
          error instanceof Error ? error.message : 'Unknown error',
        ).catch(() => {}); // Don't fail if history save fails

        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: translateError(error),
        });
      }
    }),

  // Get generation progress
  getProgress: protectedProcedure
    .query(({ ctx }) => {
      const progressKey = getProgressKey(ctx.userId);
      const progress = getProgress(progressKey);
      return progress || { step: 'idle' as const, message: '' };
    }),

  // List articles
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).default({}),
    )
    .query(async ({ ctx, input }) => {
      return getArticles(ctx.userId, input.limit, input.offset);
    }),

  // Get single article
  get: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const article = await getArticleById(input.articleId, ctx.userId);
      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '記事が見つかりません' });
      }
      return article;
    }),

  // Update article
  update: protectedProcedure
    .input(updateArticleSchema)
    .mutation(async ({ ctx, input }) => {
      const { articleId, ...data } = input;
      await updateArticle(articleId, ctx.userId, data);
      return { success: true, articleId, updatedAt: new Date().toISOString() };
    }),

  // Delete article
  delete: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteArticle(input.articleId, ctx.userId);
      return { success: true };
    }),

  // Check duplicate video
  checkDuplicate: protectedProcedure
    .input(z.object({ videoUrl: z.string() }))
    .query(async ({ ctx, input }) => {
      const videoId = getVideoId(input.videoUrl);
      return checkDuplicateVideo(ctx.userId, videoId);
    }),

  // Add image instructions to article (LLM-powered when API key available)
  addImageInstructions: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const article = await getArticleById(input.articleId, ctx.userId);
      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '記事が見つかりません' });
      }

      let updatedMarkdown: string;
      const openaiApiKey = await getDecryptedApiKey(ctx.userId, 'openai');

      if (openaiApiKey) {
        // Use LLM for contextual image descriptions
        try {
          updatedMarkdown = await insertImageInstructionsWithLLM(
            article.markdownContent,
            openaiApiKey,
          );
        } catch (err) {
          console.warn('[imageInstructions] LLM failed, falling back to rule-based:', err instanceof Error ? err.message : err);
          updatedMarkdown = insertImageInstructions(article.markdownContent);
        }
      } else {
        // Fallback to rule-based insertion
        updatedMarkdown = insertImageInstructions(article.markdownContent);
      }

      await updateArticle(input.articleId, ctx.userId, {
        markdownContent: updatedMarkdown,
      });

      return { markdownContent: updatedMarkdown };
    }),

  // Generate images for all [画像：〇〇] tags in article
  generateImages: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const article = await getArticleById(input.articleId, ctx.userId);
      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '記事が見つかりません' });
      }

      const googleApiKey = await getDecryptedApiKey(ctx.userId, 'google');
      if (!googleApiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Google APIキーが設定されていません。API設定画面から設定してください。',
        });
      }

      const openaiApiKey = await getDecryptedApiKey(ctx.userId, 'openai');

      try {
        const images = await generateImagesForArticle(
          article.markdownContent,
          googleApiKey,
          openaiApiKey || undefined,
          article.title,
        );
        await updateArticle(input.articleId, ctx.userId, { images });

        // Log image generation usage
        if (images.length > 0) {
          await logUsage({
            userId: ctx.userId,
            type: 'image',
            model: 'gemini-3.1-flash-image-preview',
            imageCount: images.length,
            costEstimate: (images.length * 0.02).toFixed(3),
            articleId: input.articleId,
          });
        }

        return { success: true, count: images.length, images };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: translateError(err),
        });
      }
    }),

  // Generate a single image for a specific tag
  generateSingleImage: protectedProcedure
    .input(z.object({ articleId: z.number(), tag: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const article = await getArticleById(input.articleId, ctx.userId);
      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '記事が見つかりません' });
      }

      const googleApiKey = await getDecryptedApiKey(ctx.userId, 'google');
      if (!googleApiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Google APIキーが設定されていません。API設定画面から設定してください。',
        });
      }

      const openaiApiKey = await getDecryptedApiKey(ctx.userId, 'openai');

      try {
        const image = await generateSingleImageForTag(
          input.tag,
          googleApiKey,
          openaiApiKey || undefined,
          article.title,
        );

        // Merge with existing images
        const existingImages = (article.images as Array<{ tag: string; base64: string; prompt?: string }>) || [];
        const updatedImages = [
          ...existingImages.filter((img) => img.tag !== input.tag),
          image,
        ];
        await updateArticle(input.articleId, ctx.userId, { images: updatedImages });

        // Log single image usage
        await logUsage({
          userId: ctx.userId,
          type: 'image',
          model: 'gemini-3.1-flash-image-preview',
          imageCount: 1,
          costEstimate: '0.02',
          articleId: input.articleId,
        });

        return { success: true, image };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: translateError(err),
        });
      }
    }),

  // Generate English prompts for image tags
  generateImagePrompts: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const article = await getArticleById(input.articleId, ctx.userId);
      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '記事が見つかりません' });
      }

      const openaiApiKey = await getDecryptedApiKey(ctx.userId, 'openai');
      if (!openaiApiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'OpenAI APIキーが設定されていません。',
        });
      }

      try {
        const prompts = await generateImagePrompts(
          article.markdownContent,
          article.title,
          openaiApiKey,
        );
        return { prompts };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: translateError(err),
        });
      }
    }),

  // Export article
  export: protectedProcedure
    .input(z.object({
      articleId: z.number(),
      format: z.enum(['markdown', 'wordpress']),
    }))
    .query(async ({ ctx, input }) => {
      const article = await getArticleById(input.articleId, ctx.userId);
      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '記事が見つかりません' });
      }

      if (input.format === 'markdown') {
        return exportToMarkdown(article.markdownContent, article.title);
      }

      return {
        content: exportToWordPress(article.markdownContent),
        filename: `${article.title.substring(0, 50)}.html`,
        mimeType: 'text/html',
      };
    }),

});
