/**
 * Fetch YouTube transcript via Cloudflare Worker.
 * All transcript fetching is done through the Worker to avoid CORS issues.
 * No direct YouTube API calls are made from the browser.
 */

/** Max transcript length (chars) — trim to avoid excessive token usage */
const MAX_TRANSCRIPT_LENGTH = 30000;

/**
 * Worker URL and auth token.
 * Vite replaces import.meta.env.VITE_* at build time.
 * Hardcoded fallbacks ensure the values are always available,
 * even if env vars are missing during the build.
 */
const WORKER_URL =
  import.meta.env.VITE_TRANSCRIPT_WORKER_URL ||
  'https://youtube-transcript-proxy.kurich44.workers.dev';

const AUTH_TOKEN =
  import.meta.env.VITE_TRANSCRIPT_AUTH_TOKEN ||
  'tbg-secret-2026';

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
 * This is the sole transcript fetching method.
 * videoId が取得できていれば、必ず Worker へ fetch を実行する。
 */
export async function fetchTranscriptViaWorker(
  videoId: string,
): Promise<{ text: string | null; error?: string }> {
  // Build URL — strip trailing slashes, append query param
  const cleanUrl = WORKER_URL.replace(/\/+$/, '');
  const fetchUrl = `${cleanUrl}?videoId=${videoId}`;

  console.log('[Transcript] === Fetch Start ===');
  console.log('[Transcript] URL:', fetchUrl);
  console.log('[Transcript] X-App-Auth:', AUTH_TOKEN);

  try {
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'X-App-Auth': 'tbg-secret-2026',
      },
    });

    console.log('[Transcript] Response:', response.status, response.statusText);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(could not read body)');
      console.error('[Transcript] HTTP Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
        url: fetchUrl,
      });
      return { text: null, error: `HTTP ${response.status}: ${errorBody}` };
    }

    const raw = await response.text();
    console.log('[Transcript] Raw response length:', raw.length, 'preview:', raw.substring(0, 200));

    let data: { text?: string; error?: string };
    try {
      data = JSON.parse(raw);
    } catch {
      console.error('[Transcript] JSON parse failed. Raw:', raw.substring(0, 500));
      return { text: null, error: 'Invalid JSON response from Worker' };
    }

    console.log('[Transcript] Parsed — text:', !!data.text, 'length:', data.text?.length ?? 0, 'error:', data.error ?? 'none');

    if (data.error) {
      console.error('[Transcript] Worker error:', data.error);
      return { text: null, error: data.error };
    }

    if (data.text && data.text.length > 0) {
      const trimmed = trimTranscript(data.text);
      console.log(`[Transcript] SUCCESS: ${trimmed.length} chars`);
      return { text: trimmed };
    }

    console.warn('[Transcript] Worker returned empty text');
    return { text: null, error: 'Empty transcript' };
  } catch (e) {
    console.error('[Transcript] Network error:', e);
    return { text: null, error: e instanceof Error ? e.message : 'Fetch failed' };
  }
}
