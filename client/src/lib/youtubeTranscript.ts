/**
 * YouTube transcript utilities.
 * Transcript is provided via manual paste — no external API calls.
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
 * Clean pasted transcript text:
 * - Remove timestamps (0:00, 00:00, 0:00:00 formats)
 * - Collapse multiple newlines / excess whitespace
 */
export function cleanTranscriptText(raw: string): string {
  return raw
    // Remove timestamps like 0:00, 00:00, 0:00:00 (with optional trailing space)
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*/g, '')
    // Collapse multiple newlines into single newline
    .replace(/\n{3,}/g, '\n\n')
    // Trim lines
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}
