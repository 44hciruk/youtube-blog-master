/**
 * Fetch YouTube transcript directly from the browser.
 * Because this runs in the user's browser (not a server), YouTube treats it
 * as a normal user request and does not trigger bot detection.
 */

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
