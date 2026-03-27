/**
 * Export service for converting articles to various formats
 */

/**
 * Export article as Markdown (passthrough - already in markdown)
 */
export function exportToMarkdown(markdownContent: string, title: string): {
  content: string;
  filename: string;
  mimeType: string;
} {
  return {
    content: markdownContent,
    filename: `${sanitizeFilename(title)}.md`,
    mimeType: 'text/markdown',
  };
}

/**
 * Export article as WordPress-compatible HTML
 * Strips image instructions and converts markdown to basic WordPress HTML
 */
export function exportToWordPress(markdownContent: string): string {
  let html = markdownContent;

  // Convert headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Convert bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Convert lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>\n$1</ul>\n');

  // Convert image instructions to HTML comments (placeholders for actual images)
  html = html.replace(
    /\[画像：(.+?)\]/g,
    '<!-- 画像挿入: $1 -->',
  );

  // Convert paragraphs (lines that aren't HTML tags)
  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith('<') &&
      !trimmed.startsWith('<!--')
    ) {
      result.push(`<p>${trimmed}</p>`);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Sanitize filename for downloads
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

export { sanitizeFilename };
