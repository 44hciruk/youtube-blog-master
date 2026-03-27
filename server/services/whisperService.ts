import OpenAI from 'openai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import YTDlpWrap from 'yt-dlp-wrap';

const YT_DLP_PATH = process.env.YT_DLP_PATH || '/opt/homebrew/bin/yt-dlp';

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
 * Download audio from YouTube video using yt-dlp, save as temp file,
 * transcribe with Whisper, then delete the temp file.
 */
export async function downloadAndTranscribe(
  videoId: string,
  apiKey: string,
  language?: string,
): Promise<{ transcript: string; language: string }> {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `ytbm_${videoId}_${Date.now()}`);
  const audioFile = `${tmpFile}.webm`;

  try {
    // Download audio-only stream via yt-dlp
    const ytDlp = new YTDlpWrap(YT_DLP_PATH);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    await ytDlp.execPromise([
      videoUrl,
      '--format', 'bestaudio[ext=webm]/bestaudio/best',
      '--output', audioFile,
      '--no-playlist',
      '--quiet',
    ]);

    if (!fs.existsSync(audioFile)) {
      throw new Error('音声ファイルのダウンロードに失敗しました');
    }

    const audioBuffer = fs.readFileSync(audioFile);
    const openai = new OpenAI({ apiKey });

    // Upload as a File object with webm mime type
    const file = new File([new Uint8Array(audioBuffer)], 'audio.webm', { type: 'audio/webm' });

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
  } finally {
    // Always clean up temp file
    if (fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile);
    }
  }
}

/**
 * Legacy: Download audio buffer (kept for backward compatibility).
 * Now delegates to downloadAndTranscribe internally.
 */
export async function downloadAudioFromYouTube(
  videoId: string,
): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const audioFile = path.join(tmpDir, `ytbm_${videoId}_${Date.now()}.webm`);

  try {
    const ytDlp = new YTDlpWrap(YT_DLP_PATH);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    await ytDlp.execPromise([
      videoUrl,
      '--format', 'bestaudio[ext=webm]/bestaudio/best',
      '--output', audioFile,
      '--no-playlist',
      '--quiet',
    ]);

    if (!fs.existsSync(audioFile)) {
      throw new Error('音声ファイルのダウンロードに失敗しました');
    }

    return fs.readFileSync(audioFile);
  } finally {
    if (fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile);
    }
  }
}
