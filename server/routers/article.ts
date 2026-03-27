import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { getDecryptedApiKey } from '../helpers/apiKeys';
import { createArticle, getArticles, getArticleById, updateArticle, deleteArticle, checkDuplicateVideo } from '../helpers/articles';
import { saveGenerationHistory } from '../helpers/generationHistory';
import { getVideoId, getVideoMetadata, getVideoTranscript } from '../services/youtubeService';
import { normalizeTranscript, extractKeywords, extractMainPoints } from '../services/textNormalization';
import { generateArticle } from '../services/articleGenerationService';
import { insertImageInstructions } from '../services/imageInstructionService';
import { generateImagesForArticle } from '../services/imageGenerationService';
import { exportToMarkdown, exportToWordPress } from '../services/exportService';
import { generateArticleSchema, updateArticleSchema } from '../utils/validation';

export const articleRouter = router({
  // Generate article from YouTube video
  generate: protectedProcedure
    .input(generateArticleSchema)
    .mutation(async ({ ctx, input }) => {
      // Check API keys
      const [openaiApiKey, youtubeApiKey] = await Promise.all([
        getDecryptedApiKey(ctx.userId, 'openai'),
        getDecryptedApiKey(ctx.userId, 'youtube'),
      ]);

      if (!openaiApiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'OpenAI APIキーが設定されていません。',
        });
      }
      if (!youtubeApiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'YouTube APIキーが設定されていません。',
        });
      }

      const videoId = getVideoId(input.videoUrl);

      try {
        // Get video data
        const metadata = await getVideoMetadata(videoId, youtubeApiKey);
        const transcriptResult = await getVideoTranscript(videoId, youtubeApiKey);
        const normalizedTranscript = normalizeTranscript(transcriptResult.transcript);
        const extractedKeywords = extractKeywords(normalizedTranscript);
        const mainPoints = extractMainPoints(normalizedTranscript);

        // Generate article
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

        // Save to database
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
        });

        // Save generation history
        await saveGenerationHistory(ctx.userId, input.videoUrl, videoId, 'success');

        return {
          articleId,
          title: generated.title,
          markdownContent: generated.markdownContent,
          wordCount: generated.wordCount,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        // Save failed history
        await saveGenerationHistory(
          ctx.userId,
          input.videoUrl,
          videoId,
          'failed',
          error instanceof Error ? error.message : 'Unknown error',
        ).catch(() => {}); // Don't fail if history save fails

        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : '記事生成に失敗しました';
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
      }
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

  // Add image instructions to article
  addImageInstructions: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const article = await getArticleById(input.articleId, ctx.userId);
      if (!article) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '記事が見つかりません' });
      }

      const updatedMarkdown = insertImageInstructions(article.markdownContent);
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

      try {
        const images = await generateImagesForArticle(article.markdownContent, googleApiKey);
        await updateArticle(input.articleId, ctx.userId, { images });
        return { success: true, count: images.length, images };
      } catch (err) {
        const message = err instanceof Error ? err.message : '画像生成に失敗しました';
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
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
