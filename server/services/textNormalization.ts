/**
 * Normalize transcript text for processing
 */
export function normalizeTranscript(text: string): string {
  return (
    text
      // Remove timestamps like [00:01:23] or (1:23)
      .replace(/[\[\(]\d{0,2}:?\d{1,2}:\d{2}[\]\)]/g, '')
      // Remove speaker labels like "Speaker 1:" or "話者1:"
      .replace(/(?:Speaker|話者)\s*\d+\s*[:：]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove duplicate consecutive sentences
      .replace(/(.{10,}?)\1+/g, '$1')
      // Normalize Japanese punctuation
      .replace(/、{2,}/g, '、')
      .replace(/。{2,}/g, '。')
      // Remove filler words (Japanese)
      .replace(/(?:えーと|あのー|えー|まあ|んー|うーん)(?:、)?/g, '')
      // Clean up extra spaces
      .trim()
  );
}

/**
 * Extract keywords from text using simple frequency analysis
 */
export function extractKeywords(text: string, maxKeywords = 10): string[] {
  // Remove common Japanese particles and stop words
  const stopWords = new Set([
    'の', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'や', 'か',
    'て', 'た', 'だ', 'する', 'いる', 'ある', 'こと', 'もの', 'ない',
    'れる', 'られる', 'です', 'ます', 'この', 'その', 'あの', 'どの',
    'これ', 'それ', 'あれ', 'ここ', 'そこ', 'から', 'まで', 'より',
    'ため', 'よう', 'なる', 'れる', 'という', 'ので', 'けど',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'that', 'this', 'it', 'not', 'you', 'we', 'they', 'he', 'she',
  ]);

  // Simple word frequency for katakana/English terms (most likely keywords)
  const katakanaPattern = /[\u30A0-\u30FF]{2,}/g;
  const kanjiPattern = /[\u4E00-\u9FFF]{2,}/g;

  const katakanaWords = text.match(katakanaPattern) || [];
  const kanjiWords = text.match(kanjiPattern) || [];
  const allWords = [...katakanaWords, ...kanjiWords];

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of allWords) {
    if (!stopWords.has(word) && word.length >= 2) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }

  // Sort by frequency and return top keywords
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Extract main points from transcript
 */
export function extractMainPoints(text: string, maxPoints = 5): string[] {
  // Split into sentences
  const sentences = text
    .split(/[。\.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.length < 200);

  if (sentences.length === 0) return [];

  // Score sentences by keyword density and position
  const keywords = extractKeywords(text, 20);
  const scored = sentences.map((sentence, index) => {
    let score = 0;
    // Keyword presence
    for (const kw of keywords) {
      if (sentence.includes(kw)) score += 2;
    }
    // Prefer sentences with assertive patterns
    if (/(?:です|ます|ください|重要|大切|ポイント|注意|必要)/.test(sentence)) {
      score += 3;
    }
    // Slight preference for early sentences
    score += Math.max(0, 5 - index * 0.5);
    return { sentence, score };
  });

  // Return top scoring sentences
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPoints)
    .map((s) => s.sentence);
}
