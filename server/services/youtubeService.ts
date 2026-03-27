import { extractVideoId } from '../utils/validation';
import { YoutubeTranscript } from 'youtube-transcript';

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
  // Normalize youtu.be short URLs first
  const normalized = normalizeYouTubeUrl(url);
  const id = extractVideoId(normalized);
  if (!id) {
    throw new Error('無効なYouTube URLです');
  }
  return id;
}

/**
 * Normalize various YouTube URL formats to standard watch URL
 */
function normalizeYouTubeUrl(url: string): string {
  // Handle youtu.be short URLs
  const shortMatch = url.match(/^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return `https://www.youtube.com/watch?v=${shortMatch[1]}`;
  }
  // Handle shorts URLs
  const shortsMatch = url.match(/^https?:\/\/(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) {
    return `https://www.youtube.com/watch?v=${shortsMatch[2]}`;
  }
  return url;
}

/**
 * Fetch video metadata using YouTube Data API v3
 */
export async function getVideoMetadata(
  videoId: string,
  apiKey: string,
): Promise<VideoMetadata> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;

  console.log(`[YouTube] Fetching metadata for video: ${videoId}`);

  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const errorMsg = (error as Record<string, unknown>).message || 'Unknown error';
    console.error(`[YouTube] API error: ${res.status} - ${errorMsg}`);

    if (res.status === 403) {
      throw new Error('YouTube APIキーが無効か、クォータを超過しています。API設定を確認してください。');
    }
    if (res.status === 404) {
      throw new Error('動画が見つかりません。URLを確認してください。');
    }
    throw new Error(`YouTube APIエラー: ${res.status} - ${errorMsg}`);
  }

  const data = await res.json();
  const items = (data as { items?: Array<Record<string, unknown>> }).items;
  if (!items || items.length === 0) {
    throw new Error('動画が見つかりません。削除されたか非公開の可能性があります。');
  }

  const item = items[0];
  const snippet = item.snippet as Record<string, unknown>;
  const contentDetails = item.contentDetails as Record<string, unknown>;

  console.log(`[YouTube] Metadata fetched: "${snippet.title}"`);

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
 * Fetch video transcript/captions with multiple fallback strategies
 *
 * Strategy order:
 * 1. youtube-transcript package (most reliable)
 * 2. Unofficial innertube API scraping
 * 3. YouTube Data API v3 captions.list + innertube
 * 4. Throw TRANSCRIPT_NOT_AVAILABLE (caller handles Whisper fallback)
 */
export async function getVideoTranscript(
  videoId: string,
  apiKey: string,
): Promise<{ transcript: string; segments: TranscriptSegment[]; language: string }> {
  console.log(`[YouTube] Attempting to fetch transcript for video: ${videoId}`);

  // Strategy 1: youtube-transcript package (most reliable)
  try {
    console.log('[YouTube] Strategy 1: youtube-transcript package');
    const result = await fetchWithYoutubeTranscriptPackage(videoId);
    if (result && result.transcript.length > 50) {
      console.log(`[YouTube] Strategy 1 succeeded: ${result.transcript.length} chars, lang=${result.language}`);
      return result;
    }
    console.log('[YouTube] Strategy 1: transcript too short or empty');
  } catch (error) {
    console.log(`[YouTube] Strategy 1 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Strategy 2: Unofficial innertube API (scrape watch page)
  try {
    console.log('[YouTube] Strategy 2: innertube API scraping');
    const result = await fetchInnertubeTranscript(videoId, 'ja');
    if (result && result.transcript.length > 50) {
      console.log(`[YouTube] Strategy 2 succeeded: ${result.transcript.length} chars, lang=${result.language}`);
      return result;
    }
    // Try English if Japanese failed
    const resultEn = await fetchInnertubeTranscript(videoId, 'en');
    if (resultEn && resultEn.transcript.length > 50) {
      console.log(`[YouTube] Strategy 2 (en) succeeded: ${resultEn.transcript.length} chars`);
      return resultEn;
    }
    console.log('[YouTube] Strategy 2: transcript too short or empty');
  } catch (error) {
    console.log(`[YouTube] Strategy 2 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Strategy 3: YouTube Data API captions.list → innertube
  try {
    console.log('[YouTube] Strategy 3: YouTube Data API captions.list');
    const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    const captionsRes = await fetch(captionsUrl);

    if (captionsRes.ok) {
      const captionsData = await captionsRes.json();
      const items = (captionsData as { items?: Array<Record<string, unknown>> }).items || [];
      console.log(`[YouTube] Strategy 3: Found ${items.length} caption tracks`);

      if (items.length > 0) {
        // We know captions exist, try innertube with specific language
        const manualCaption = items.find(item => {
          const snippet = item.snippet as Record<string, unknown>;
          return snippet.trackKind === 'standard';
        });
        const autoCaption = items.find(item => {
          const snippet = item.snippet as Record<string, unknown>;
          return snippet.trackKind === 'ASR';
        });
        const caption = manualCaption || autoCaption;
        if (caption) {
          const snippet = caption.snippet as Record<string, unknown>;
          const lang = snippet.language as string || 'ja';
          console.log(`[YouTube] Strategy 3: Trying innertube with lang=${lang}`);
          const result = await fetchInnertubeTranscript(videoId, lang);
          if (result && result.transcript.length > 50) {
            console.log(`[YouTube] Strategy 3 succeeded: ${result.transcript.length} chars`);
            return result;
          }
        }
      }
    } else {
      const errorData = await captionsRes.json().catch(() => ({}));
      console.log(`[YouTube] Strategy 3: captions.list API error: ${captionsRes.status}`, errorData);
    }
  } catch (error) {
    console.log(`[YouTube] Strategy 3 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // All strategies failed
  console.log('[YouTube] All transcript strategies failed. Whisper fallback needed.');
  throw new Error('TRANSCRIPT_NOT_AVAILABLE');
}

/**
 * Strategy 1: Use youtube-transcript npm package
 */
async function fetchWithYoutubeTranscriptPackage(
  videoId: string,
): Promise<{ transcript: string; segments: TranscriptSegment[]; language: string } | null> {
  const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
    lang: 'ja',
  });

  if (!transcriptItems || transcriptItems.length === 0) {
    // Try without language specification (auto-detect)
    const fallbackItems = await YoutubeTranscript.fetchTranscript(videoId);
    if (!fallbackItems || fallbackItems.length === 0) {
      return null;
    }
    const segments: TranscriptSegment[] = fallbackItems.map(item => ({
      text: item.text,
      start: item.offset / 1000,
      duration: item.duration / 1000,
    }));
    return {
      transcript: segments.map(s => s.text).join(' '),
      segments,
      language: 'auto',
    };
  }

  const segments: TranscriptSegment[] = transcriptItems.map(item => ({
    text: item.text,
    start: item.offset / 1000,
    duration: item.duration / 1000,
  }));

  return {
    transcript: segments.map(s => s.text).join(' '),
    segments,
    language: 'ja',
  };
}

/**
 * Strategy 2: Fetch transcript from YouTube's innertube API
 * Scrapes the watch page to extract caption tracks, then fetches the XML
 */
async function fetchInnertubeTranscript(
  videoId: string,
  language: string,
): Promise<{ transcript: string; segments: TranscriptSegment[]; language: string } | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': `${language},en;q=0.9`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      console.log(`[YouTube] innertube: watch page returned ${res.status}`);
      return null;
    }

    const html = await res.text();

    // Extract captions from ytInitialPlayerResponse using a more robust regex
    // The JSON object can be very large, so we use a balanced-brace approach
    const startMarker = 'ytInitialPlayerResponse = ';
    const startIdx = html.indexOf(startMarker);
    if (startIdx === -1) {
      console.log('[YouTube] innertube: ytInitialPlayerResponse not found');
      return null;
    }

    const jsonStart = startIdx + startMarker.length;
    // Find the end of the JSON object by tracking braces
    let braceCount = 0;
    let jsonEnd = jsonStart;
    for (let i = jsonStart; i < html.length && i < jsonStart + 500000; i++) {
      if (html[i] === '{') braceCount++;
      if (html[i] === '}') braceCount--;
      if (braceCount === 0) {
        jsonEnd = i + 1;
        break;
      }
    }

    if (jsonEnd <= jsonStart) {
      console.log('[YouTube] innertube: could not parse ytInitialPlayerResponse JSON boundaries');
      return null;
    }

    const jsonStr = html.substring(jsonStart, jsonEnd);
    let playerResponse: Record<string, unknown>;
    try {
      playerResponse = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.log('[YouTube] innertube: JSON parse failed');
      return null;
    }

    const captions = playerResponse?.captions as Record<string, unknown> | undefined;
    const renderer = captions?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined;
    const captionTracks = renderer?.captionTracks as Array<Record<string, string>> | undefined;

    if (!captionTracks || captionTracks.length === 0) {
      console.log('[YouTube] innertube: no caption tracks found');
      return null;
    }

    console.log(`[YouTube] innertube: found ${captionTracks.length} caption tracks: ${captionTracks.map(t => t.languageCode).join(', ')}`);

    // Find the best caption track
    const track =
      captionTracks.find(t => t.languageCode === language) ||
      captionTracks.find(t => t.languageCode?.startsWith(language.split('-')[0])) ||
      captionTracks[0];

    const captionUrl = track.baseUrl;
    if (!captionUrl) {
      console.log('[YouTube] innertube: caption track has no baseUrl');
      return null;
    }

    console.log(`[YouTube] innertube: fetching captions from track lang=${track.languageCode}`);

    const captionRes = await fetch(captionUrl);
    if (!captionRes.ok) {
      console.log(`[YouTube] innertube: caption fetch returned ${captionRes.status}`);
      return null;
    }

    const captionXml = await captionRes.text();
    const segments = parseTranscriptXml(captionXml);

    if (segments.length === 0) {
      console.log('[YouTube] innertube: parsed 0 segments from XML');
      return null;
    }

    const transcript = segments.map(s => s.text).join(' ');
    console.log(`[YouTube] innertube: parsed ${segments.length} segments, ${transcript.length} chars`);

    return {
      transcript,
      segments,
      language: track.languageCode || language,
    };
  } catch (error) {
    console.log(`[YouTube] innertube error: ${error instanceof Error ? error.message : 'Unknown'}`);
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
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
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

export { parseDuration, parseTranscriptXml, decodeXmlEntities, normalizeYouTubeUrl };
export type { VideoMetadata, TranscriptSegment };
