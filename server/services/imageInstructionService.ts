/**
 * Image Instruction Engine
 * Identifies image insertion points and generates search keywords
 */

interface ImagePoint {
  position: number; // Line number in markdown
  keyword: string;  // Search keyword for image
  context: string;  // Section context
}

/**
 * Identify optimal image insertion points in markdown content
 */
export function identifyImagePoints(markdownContent: string): ImagePoint[] {
  const lines = markdownContent.split('\n');
  const imagePoints: ImagePoint[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Insert after h1 (title) - hero image
    if (/^# /.test(line) && i < 5) {
      const nextContentLine = findNextContentLine(lines, i);
      if (nextContentLine > 0) {
        imagePoints.push({
          position: nextContentLine + 1,
          keyword: extractKeywordFromHeading(line),
          context: 'hero',
        });
      }
    }

    // Insert after h2 headings - section images
    if (/^## /.test(line)) {
      const nextContentLine = findNextContentLine(lines, i);
      if (nextContentLine > 0) {
        imagePoints.push({
          position: nextContentLine + 1,
          keyword: extractKeywordFromHeading(line),
          context: 'section',
        });
      }
    }
  }

  return imagePoints;
}

/**
 * Generate image search keyword from section heading and content
 */
export function generateImageKeyword(heading: string): string {
  // Remove markdown syntax
  const clean = heading.replace(/^#+\s*/, '').replace(/[：:]/g, ' ').trim();

  // Map common Japanese terms to visual search keywords
  const mappings: Record<string, string> = {
    'まとめ': 'ビジネスマンのスーツ姿',
    'よくある質問': 'スーツの着こなし アドバイス',
    '歴史的背景': '英国紳士 クラシックスーツ',
    'シーン別': 'ビジネスシーン スーツ',
    '知っておくべき': 'スーツの基本 ビジネスマン',
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (clean.includes(key)) return value;
  }

  return clean;
}

/**
 * Insert image instructions into markdown content
 */
export function insertImageInstructions(
  markdownContent: string,
  imagePoints?: ImagePoint[],
): string {
  const points = imagePoints || identifyImagePoints(markdownContent);
  if (points.length === 0) return markdownContent;

  const lines = markdownContent.split('\n');
  const result: string[] = [];

  // Track which lines should have images inserted after them
  const insertionMap = new Map<number, string>();
  for (const point of points) {
    const keyword = generateImageKeyword(
      lines[point.position - 2] || point.keyword,
    );
    insertionMap.set(point.position, keyword);
  }

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    const lineNum = i + 1;
    if (insertionMap.has(lineNum)) {
      result.push('');
      result.push(`[画像：${insertionMap.get(lineNum)}]`);
      result.push('');
    }
  }

  return result.join('\n');
}

/**
 * Find the next non-empty content line after a heading
 */
function findNextContentLine(lines: string[], headingIndex: number): number {
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#')) {
      return i;
    }
  }
  return -1;
}

/**
 * Extract a meaningful keyword from heading text
 */
function extractKeywordFromHeading(heading: string): string {
  return heading.replace(/^#+\s*/, '').trim();
}
