import { extractVideoId } from '../utils/validation';

interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  duration: number;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function getVideoId(url: string): string {
  const id = extractVideoId(url);
  if (!id) {
    throw new Error('無効なYouTube URLです');
  }
  return id;
}

/**
 * Fetch video metadata using YouTube Data API v3
 */
export async function getVideoMetadata(
  videoId: string,
  apiKey: string,
): Promise<VideoMetadata> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      `YouTube API error: ${res.status} - ${(error as Record<string, unknown>).message || 'Unknown error'}`,
    );
  }

  const data = await res.json();
  const items = (data as { items?: Array<Record<string, unknown>> }).items;
  if (!items || items.length === 0) {
    throw new Error('動画が見つかりません。削除されたか非公開の可能性があります。');
  }

  const item = items[0];
  const snippet = item.snippet as Record<string, unknown>;
  const contentDetails = item.contentDetails as Record<string, unknown>;

  return {
    videoId,
    title: snippet.title as string,
    description: snippet.description as string,
    duration: parseDuration(contentDetails.duration as string),
    channelTitle: snippet.channelTitle as string,
    publishedAt: snippet.publishedAt as string,
    thumbnailUrl: ((snippet.thumbnails as Record<string, unknown>)?.high as Record<string, unknown>)?.url as string || '',
  };
}

/**
 * Fetch video transcript/captions using YouTube Data API v3
 * Tries captions list first, falls back to unofficial transcript endpoint
 */
export async function getVideoTranscript(
  videoId: string,
  apiKey: string,
): Promise<{ transcript: string; segments: TranscriptSegment[]; language: string }> {
  // Try to get captions list
  const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
  const captionsRes = await fetch(captionsUrl);

  if (captionsRes.ok) {
    const captionsData = await captionsRes.json();
    const items = (captionsData as { items?: Array<Record<string, unknown>> }).items || [];

    // Prefer manual captions, then auto-generated
    const manualCaption = items.find(
      (item) => {
        const snippet = item.snippet as Record<string, unknown>;
        return snippet.trackKind === 'standard';
      },
    );
    const autoCaption = items.find(
      (item) => {
        const snippet = item.snippet as Record<string, unknown>;
        return snippet.trackKind === 'ASR';
      },
    );

    const caption = manualCaption || autoCaption;
    if (caption) {
      const snippet = caption.snippet as Record<string, unknown>;
      const language = snippet.language as string || 'ja';

      // Try unofficial transcript endpoint for the actual text
      const transcriptResult = await fetchUnofficialTranscript(videoId, language);
      if (transcriptResult) {
        return transcriptResult;
      }
    }
  }

  // Fallback: try unofficial transcript endpoint directly
  const transcriptResult = await fetchUnofficialTranscript(videoId, 'ja');
  if (transcriptResult) {
    return transcriptResult;
  }

  // No transcript available - will need Whisper
  throw new Error('TRANSCRIPT_NOT_AVAILABLE');
}

/**
 * Fetch transcript from YouTube's unofficial transcript endpoint
 */
async function fetchUnofficialTranscript(
  videoId: string,
  language: string,
): Promise<{ transcript: string; segments: TranscriptSegment[]; language: string } | null> {
  try {
    // Use innertube API to get transcript
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': `${language},en;q=0.9`,
      },
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Extract captions from ytInitialPlayerResponse
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);
    if (!playerResponseMatch) return null;

    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captionTracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) return null;

    // Find the best caption track
    const track =
      captionTracks.find((t: Record<string, string>) => t.languageCode === language) ||
      captionTracks[0];

    const captionUrl = track.baseUrl;
    const captionRes = await fetch(captionUrl);
    if (!captionRes.ok) return null;

    const captionXml = await captionRes.text();
    const segments = parseTranscriptXml(captionXml);
    const transcript = segments.map((s) => s.text).join(' ');

    return {
      transcript,
      segments,
      language: track.languageCode || language,
    };
  } catch {
    return null;
  }
}

/**
 * Parse YouTube's transcript XML format
 */
function parseTranscriptXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const text = decodeXmlEntities(match[3].trim());
    if (text) {
      segments.push({
        start: parseFloat(match[1]),
        duration: parseFloat(match[2]),
        text,
      });
    }
  }

  return segments;
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // Remove any HTML tags first
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Parse ISO 8601 duration (PT1H2M3S) to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export { parseDuration, parseTranscriptXml, decodeXmlEntities };
export type { VideoMetadata, TranscriptSegment };
