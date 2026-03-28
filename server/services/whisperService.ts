import OpenAI from 'openai';

/**
 * Download audio from YouTube using @distube/ytdl-core and transcribe with Whisper API.
 * This is the primary fallback when YouTube captions are not available.
 */
export async function downloadAndTranscribe(
  videoId: string,
  apiKey: string,
  language?: string,
): Promise<{ transcript: string; language: string }> {
  console.log(`[Whisper] 音声取得開始: ${videoId}`);

  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Dynamic import to avoid ESM/CJS bundling issues
  const ytdl = await import('@distube/ytdl-core');
  const downloadFn = ytdl.default || ytdl;

  // Get audio-only stream
  const audioStream = downloadFn(url, {
    filter: 'audioonly',
    quality: 'lowestaudio',
  });

  // Convert stream to Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  if (buffer.length === 0) {
    throw new Error('音声データの取得に失敗しました');
  }

  console.log(`[Whisper] 音声取得完了: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  // Whisper API has a 25MB file size limit
  if (buffer.length > 25 * 1024 * 1024) {
    console.warn(`[Whisper] 音声ファイルが大きすぎます (${(buffer.length / 1024 / 1024).toFixed(1)}MB)。25MB制限を超えています。`);
    throw new Error('動画が長すぎます。Whisper APIの25MB制限を超えています。');
  }

  // Send to Whisper API
  const openai = new OpenAI({ apiKey });

  const file = new File([new Uint8Array(buffer)], 'audio.webm', {
    type: 'audio/webm',
  });

  console.log(`[Whisper] Whisper APIに送信中...`);

  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: language || 'ja',
    response_format: 'verbose_json',
  });

  const transcript = response.text;
  const detectedLang =
    (response as unknown as Record<string, string>).language ||
    language ||
    'ja';

  console.log(
    `[Whisper] 文字起こし完了: ${transcript.length}文字 (lang=${detectedLang})`,
  );

  return { transcript, language: detectedLang };
}

/**
 * Transcribe audio buffer directly with Whisper API.
 * Kept for backward compatibility.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  apiKey: string,
  language?: string,
): Promise<{ transcript: string; language: string }> {
  const openai = new OpenAI({ apiKey });

  const file = new File([new Uint8Array(audioBuffer)], 'audio.webm', {
    type: 'audio/webm',
  });

  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: language || undefined,
    response_format: 'verbose_json',
  });

  return {
    transcript: response.text,
    language:
      (response as unknown as Record<string, string>).language ||
      language ||
      'ja',
  };
}
