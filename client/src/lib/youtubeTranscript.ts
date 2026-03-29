/**
 * Fetch YouTube transcript via Cloudflare Worker.
 * All transcript fetching is done through the Worker to avoid CORS issues.
 * No direct YouTube API calls are made from the browser.
 */

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
  // Read env vars at call time (not module load time) to ensure Vite has injected them
  const workerUrl = import.meta.env.VITE_TRANSCRIPT_WORKER_URL || '';
  const authToken = import.meta.env.VITE_TRANSCRIPT_AUTH_TOKEN || 'tbg-secret-2026';

  if (!workerUrl) {
    console.error('[Transcript] VITE_TRANSCRIPT_WORKER_URL is not set');
    return { text: null, error: 'Worker URL not configured' };
  }

  // Build URL — ensure no trailing slash before query params
  const cleanUrl = workerUrl.replace(/\/+$/, '');
  const fetchUrl = `${cleanUrl}?videoId=${videoId}`;

  console.log('[Transcript] === Fetch Start ===');
  console.log('[Transcript] Full URL:', fetchUrl);
  console.log('[Transcript] Auth token:', authToken ? `${authToken.substring(0, 4)}...` : '(empty)');

  try {
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'X-App-Auth': authToken,
      },
    });

    console.log('[Transcript] Response status:', response.status, 'ok:', response.ok);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(could not read body)');
      console.error('[Transcript] Worker error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      });
      return { text: null, error: `Worker error: ${response.status} - ${errorBody}` };
    }

    const data = await response.json() as { text?: string; error?: string };

    console.log('[Transcript] Parsed response - text:', !!data.text, 'length:', data.text?.length ?? 0, 'error:', data.error ?? 'none');

    if (data.error) {
      console.warn('[Transcript] Worker returned error field:', data.error);
      return { text: null, error: data.error };
    }

    if (data.text && data.text.length > 0) {
      const trimmed = trimTranscript(data.text);
      console.log(`[Transcript] Success: ${trimmed.length} chars`);
      return { text: trimmed };
    }

    console.warn('[Transcript] Worker returned empty text');
    return { text: null, error: 'Empty transcript' };
  } catch (e) {
    console.error('[Transcript] Network/fetch error:', e);
    return { text: null, error: e instanceof Error ? e.message : 'Fetch failed' };
  }
}
