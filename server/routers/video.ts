import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { getDecryptedApiKey } from '../helpers/apiKeys';
import { getVideoId, getVideoMetadata, getVideoTranscript } from '../services/youtubeService';
import { normalizeTranscript, extractKeywords, extractMainPoints } from '../services/textNormalization';
import { downloadAndTranscribe } from '../services/whisperService';
import { youtubeUrlSchema } from '../utils/validation';

export const videoRouter = router({
  analyze: protectedProcedure
    .input(z.object({ videoUrl: youtubeUrlSchema }))
    .mutation(async ({ ctx, input }) => {
      // Get user's YouTube API key
      const youtubeApiKey = await getDecryptedApiKey(ctx.userId, 'youtube');
      if (!youtubeApiKey) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'YouTube APIキーが設定されていません。API設定画面から設定してください。',
        });
      }

      // Extract video ID
      const videoId = getVideoId(input.videoUrl);

      try {
        // Get video metadata
        const metadata = await getVideoMetadata(videoId, youtubeApiKey);

        // Get transcript
        let transcript: string;
        let language: string;

        try {
          const transcriptResult = await getVideoTranscript(videoId, youtubeApiKey);
          transcript = transcriptResult.transcript;
          language = transcriptResult.language;
        } catch (error) {
          if (error instanceof Error && error.message === 'TRANSCRIPT_NOT_AVAILABLE') {
            // Fallback: try Whisper (requires OpenAI key)
            console.log('[Video] Transcript not available, trying Whisper fallback...');
            const openaiApiKey = await getDecryptedApiKey(ctx.userId, 'openai');
            if (!openaiApiKey) {
              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'この動画には字幕がありません。音声認識にはOpenAI APIキーが必要です。',
              });
            }
            try {
              const whisperResult = await downloadAndTranscribe(videoId, openaiApiKey);
              transcript = whisperResult.transcript;
              language = whisperResult.language;
            } catch (whisperError) {
              const msg = whisperError instanceof Error ? whisperError.message : '音声認識に失敗しました';
              throw new TRPCError({ code: 'UNPROCESSABLE_CONTENT', message: msg });
            }
          } else {
            // Re-throw non-transcript errors
            throw error;
          }
        }

        // Normalize transcript
        const normalizedTranscript = normalizeTranscript(transcript);

        // Extract keywords and main points
        const extractedKeywords = extractKeywords(normalizedTranscript);
        const mainPoints = extractMainPoints(normalizedTranscript);

        return {
          videoId,
          title: metadata.title,
          duration: metadata.duration,
          transcript: normalizedTranscript,
          language,
          extractedKeywords,
          mainPoints,
          channelTitle: metadata.channelTitle,
          thumbnailUrl: metadata.thumbnailUrl,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : '動画解析に失敗しました';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),
});
