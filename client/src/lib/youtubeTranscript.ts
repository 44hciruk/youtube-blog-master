/**
 * Fetch YouTube transcript via Cloudflare Worker or directly from the browser.
 */

const TRANSCRIPT_WORKER_URL = import.meta.env.VITE_TRANSCRIPT_WORKER_URL || '';
const TRANSCRIPT_AUTH_TOKEN = import.meta.env.VITE_TRANSCRIPT_AUTH_TOKEN || '';

/** Max transcript length (chars) — trim to avoid excessive token usage */
const MAX_TRANSCRIPT_LENGTH = 30000;

/**
 * Trim transcript to max length with graceful suffix
 */
function trimTranscript(text: string): string {
  if (text.length <= MAX_TRANSCRIPT_LENGTH) return text;
  return text.substring(0, MAX_TRANSCRIPT_LENGTH) + '...（以下略）';
}

/**
 * Fetch transcript via Cloudflare Worker proxy.
 * Returns the transcript text or null if unavailable.
 */
export async function fetchTranscriptViaWorker(
  videoId: string,
): Promise<{ text: string | null; error?: string }> {
  if (!TRANSCRIPT_WORKER_URL) {
    return { text: null, error: 'Worker URL not configured' };
  }

  try {
    console.log(`[Transcript] Fetching via Cloudflare Worker for ${videoId}`);
    const response = await fetch(
      `${TRANSCRIPT_WORKER_URL}?videoId=${videoId}`,
      {
        headers: { 'X-App-Auth': TRANSCRIPT_AUTH_TOKEN },
      },
    );

    if (!response.ok) {
      console.warn(`[Transcript] Worker returned ${response.status}`);
      return { text: null, error: `Worker error: ${response.status}` };
    }

    const data = await response.json() as { text?: string; error?: string };

    if (data.error) {
      console.warn(`[Transcript] Worker error:`, data.error);
      return { text: null, error: data.error };
    }

    if (data.text && data.text.length > 0) {
      const trimmed = trimTranscript(data.text);
      console.log(`[Transcript] Worker success: ${trimmed.length} chars`);
      return { text: trimmed };
    }

    return { text: null, error: 'Empty transcript' };
  } catch (e) {
    console.warn('[Transcript] Worker fetch failed:', e);
    return { text: null, error: e instanceof Error ? e.message : 'Fetch failed' };
  }
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Decode common XML/HTML entities in caption text
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10)),
    );
}

/**
 * Fetch transcript from YouTube using the browser's fetch (no CORS issues
 * because we use a CORS proxy or the innertube API which allows cross-origin).
 *
 * Strategy:
 * 1. Call YouTube's innertube player API to get caption track URLs
 * 2. Fetch the caption XML
 * 3. Parse and return text
 */
export async function fetchTranscriptFromBrowser(
  videoId: string,
): Promise<string | null> {
  try {
    console.log(`[Transcript] Fetching transcript for ${videoId} via innertube API`);

    // Use YouTube's innertube player API (publicly accessible, no CORS issues)
    const playerResponse = await fetch(
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240101.00.00',
            },
          },
          videoId,
        }),
      },
    );

    if (!playerResponse.ok) {
      console.warn(`[Transcript] Player API returned ${playerResponse.status}`);
      return null;
    }

    const playerData = await playerResponse.json();

    // Extract caption tracks
    const captionTracks =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      console.warn('[Transcript] No caption tracks found');
      return null;
    }

    console.log(
      `[Transcript] Found ${captionTracks.length} tracks: ${captionTracks.map((t: { languageCode: string }) => t.languageCode).join(', ')}`,
    );

    // Pick best track: ja > en > first available
    const track =
      captionTracks.find((t: { languageCode: string }) => t.languageCode === 'ja') ||
      captionTracks.find((t: { languageCode: string }) => t.languageCode?.startsWith('ja')) ||
      captionTracks.find((t: { languageCode: string }) => t.languageCode === 'en') ||
      captionTracks[0];

    if (!track?.baseUrl) {
      console.warn('[Transcript] No baseUrl in track');
      return null;
    }

    // Fetch caption XML
    const captionResponse = await fetch(track.baseUrl);
    if (!captionResponse.ok) {
      console.warn(`[Transcript] Caption XML fetch returned ${captionResponse.status}`);
      return null;
    }

    const xml = await captionResponse.text();

    // Parse XML: extract text from <text> elements
    const texts = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
      .map((m) => decodeEntities(m[1]))
      .filter((t) => t.trim().length > 0)
      .join(' ')
      .trim();

    if (texts.length < 100) {
      console.warn(`[Transcript] Text too short: ${texts.length} chars`);
      return null;
    }

    console.log(
      `[Transcript] Success: ${texts.length} chars (lang=${track.languageCode})`,
    );
    return texts;
  } catch (e) {
    console.warn('[Transcript] Browser fetch failed:', e);
    return null;
  }
}
