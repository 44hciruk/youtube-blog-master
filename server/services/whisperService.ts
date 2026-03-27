import OpenAI from 'openai';
import { Readable } from 'stream';

/**
 * Transcribe audio using OpenAI Whisper API.
 * Used as fallback when YouTube captions are not available.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  apiKey: string,
  language?: string,
): Promise<{ transcript: string; language: string }> {
  const openai = new OpenAI({ apiKey });

  // Create a File object from the buffer
  const file = new File([new Uint8Array(audioBuffer)], 'audio.mp3', { type: 'audio/mpeg' });

  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: language || undefined,
    response_format: 'verbose_json',
  });

  return {
    transcript: response.text,
    language: (response as unknown as Record<string, string>).language || language || 'ja',
  };
}

/**
 * Download audio from YouTube video.
 * Note: In production, you would use ytdl-core or a similar library.
 * For now, this is a placeholder that should be integrated with
 * an appropriate audio extraction service.
 */
export async function downloadAudioFromYouTube(
  videoId: string,
): Promise<Buffer> {
  // This is a placeholder. In a real implementation, you would:
  // 1. Use ytdl-core to download audio stream
  // 2. Or use a server-side API/service for audio extraction
  // For MVP, we rely on YouTube captions and only use Whisper as fallback
  throw new Error(
    '音声ダウンロードは現在利用できません。字幕のある動画を使用してください。',
  );
}
