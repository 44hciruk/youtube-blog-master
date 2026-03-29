/**
 * Fetch YouTube transcript via Cloudflare Worker.
 * All transcript fetching is done through the Worker to avoid CORS issues.
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
 * Fetch transcript via Cloudflare Worker proxy.
 * This is the sole transcript fetching method — no direct YouTube API calls
 * are made from the browser to avoid CORS issues.
 *
 * Returns the transcript text or null if unavailable.
 */
export async function fetchTranscriptViaWorker(
  videoId: string,
): Promise<{ text: string | null; error?: string }> {
  if (!TRANSCRIPT_WORKER_URL) {
    console.warn('[Transcript] Worker URL not configured (VITE_TRANSCRIPT_WORKER_URL is empty)');
    return { text: null, error: 'Worker URL not configured' };
  }

  const fetchUrl = `${TRANSCRIPT_WORKER_URL}?videoId=${videoId}`;

  console.log('[Transcript] Fetching transcript from:', fetchUrl);
  console.log('[Transcript] Auth token present:', !!TRANSCRIPT_AUTH_TOKEN);

  try {
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'X-App-Auth': TRANSCRIPT_AUTH_TOKEN,
      },
    });

    console.log('[Transcript] Response status:', response.status, 'ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`[Transcript] Worker returned ${response.status}:`, errorText);
      return { text: null, error: `Worker error: ${response.status}` };
    }

    const data = await response.json() as { text?: string; error?: string };

    console.log('[Transcript] Response data - text present:', !!data.text, 'text length:', data.text?.length ?? 0, 'error:', data.error ?? 'none');

    if (data.error) {
      console.warn('[Transcript] Worker returned error:', data.error);
      return { text: null, error: data.error };
    }

    if (data.text && data.text.length > 0) {
      const trimmed = trimTranscript(data.text);
      console.log(`[Transcript] Success: ${trimmed.length} chars (trimmed from ${data.text.length})`);
      return { text: trimmed };
    }

    return { text: null, error: 'Empty transcript' };
  } catch (e) {
    console.error('[Transcript] Worker fetch failed:', e);
    return { text: null, error: e instanceof Error ? e.message : 'Fetch failed' };
  }
}
