import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/Toast';
import { Tooltip } from '../components/Tooltip';

interface SavedImage {
  tag: string;
  base64: string;
  prompt?: string;
}

interface ImagePromptData {
  tag: string;
  description: string;
  englishPrompt: string;
}

type ImageStatus = 'idle' | 'generating' | 'completed' | 'failed';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/** Minimum keyword density (%) to highlight as SEO-effective */
const SEO_DENSITY_THRESHOLD = 1.0;

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** Extract keywords and their counts from Japanese text */
function extractKeywordsWithCount(text: string): { word: string; count: number; density: number }[] {
  const cleaned = text
    .replace(/^#+\s/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\n/g, '');
  const totalLength = cleaned.length || 1;

  const katakana = cleaned.match(/[\u30A0-\u30FF]{2,}/g) || [];
  const kanji = cleaned.match(/[\u4E00-\u9FFF]{2,}/g) || [];
  const english = cleaned.match(/[A-Za-z]{3,}/gi) || [];
  const allWords = [...katakana, ...kanji, ...english];

  const stopWords = new Set([
    'する', 'いる', 'ある', 'こと', 'もの', 'ない', 'なる', 'れる', 'られる',
    'です', 'ます', 'この', 'その', 'これ', 'それ', 'ここ', 'から', 'まで',
    'ため', 'よう', 'という', 'ので', 'けど', 'the', 'and', 'for', 'with',
  ]);

  const freq = new Map<string, number>();
  for (const w of allWords) {
    if (!stopWords.has(w.toLowerCase()) && w.length >= 2) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      density: parseFloat(((count * word.length / totalLength) * 100).toFixed(1)),
    }));
}

/** Convert markdown to clean WordPress HTML */
function markdownToWordPressHtml(
  md: string,
  imageMap: Map<string, string>,
  metaDescription: string,
): string {
  const lines = md.split('\n');
  const htmlLines: string[] = [];
  let h2Counter = 0;
  let h3Counter = 0;
  let inList = false;

  // Embed meta description as HTML comment
  if (metaDescription) {
    htmlLines.push(`<!-- meta description: ${metaDescription} -->`);
    htmlLines.push('');
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Headings
    const h1Match = trimmed.match(/^# (.+)$/);
    if (h1Match) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h1>${h1Match[1]}</h1>`);
      continue;
    }
    const h2Match = trimmed.match(/^## (.+)$/);
    if (h2Match) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      h2Counter++;
      h3Counter = 0;
      htmlLines.push(`<h2 id="section-${h2Counter}">${h2Match[1]}</h2>`);
      continue;
    }
    const h3Match = trimmed.match(/^### (.+)$/);
    if (h3Match) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      h3Counter++;
      htmlLines.push(`<h3 id="section-${h2Counter}-${h3Counter}">${h3Match[1]}</h3>`);
      continue;
    }

    // List items
    const liMatch = trimmed.match(/^- (.+)$/);
    if (liMatch) {
      if (!inList) { htmlLines.push('<ul>'); inList = true; }
      let content = liMatch[1];
      content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      content = content.replace(/\*(.+?)\*/g, '<em>$1</em>');
      htmlLines.push(`<li>${content}</li>`);
      continue;
    }
    if (inList && trimmed === '') {
      htmlLines.push('</ul>');
      inList = false;
    }

    // Image tags
    const imageMatch = trimmed.match(/^\[画像：(.+?)\]$/);
    if (imageMatch) {
      const fullTag = trimmed;
      const description = imageMatch[1];
      const dataUrl = imageMap.get(fullTag);
      if (dataUrl) {
        htmlLines.push(`<figure>`);
        htmlLines.push(`<img src="${dataUrl}" alt="${description}" width="100%" />`);
        htmlLines.push(`<figcaption>${description}</figcaption>`);
        htmlLines.push(`</figure>`);
      } else {
        htmlLines.push(`<!-- 画像挿入: ${description} -->`);
      }
      continue;
    }

    // Empty lines
    if (trimmed === '') {
      htmlLines.push('');
      continue;
    }

    // Regular paragraphs
    let content = trimmed;
    content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\*(.+?)\*/g, '<em>$1</em>');
    htmlLines.push(`<p>${content}</p>`);
  }

  if (inList) htmlLines.push('</ul>');
  return htmlLines.join('\n');
}

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const articleId = Number(id);
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const [markdown, setMarkdown] = useState('');
  const [title, setTitle] = useState('');
  const [sourceVideoUrl, setSourceVideoUrl] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [images, setImages] = useState<SavedImage[]>([]);
  const [imagePrompts, setImagePrompts] = useState<ImagePromptData[]>([]);
  const [imageStatuses, setImageStatuses] = useState<Map<string, ImageStatus>>(new Map());
  const [imageErrors, setImageErrors] = useState<Map<string, string>>(new Map());
  const [retryInfo, setRetryInfo] = useState<Map<string, { attempt: number; max: number }>>(new Map());
  const [bulkImageProgress, setBulkImageProgress] = useState<{ current: number; total: number } | null>(null);
  // Mobile: tab switch; Desktop: side-by-side or expanded
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  // Ref to allow aborting retries
  const retryAbortRef = useRef<Map<string, boolean>>(new Map());

  const articleQuery = trpc.article.get.useQuery(
    { articleId },
    { enabled: !!articleId },
  );

  const updateMutation = trpc.article.update.useMutation({
    onSuccess: () => showToast('保存しました', 'success'),
    onError: (err) => showToast(err.message, 'error'),
  });

  const imageInstructionsMutation = trpc.article.addImageInstructions.useMutation({
    onSuccess: (data) => {
      setMarkdown(data.markdownContent);
      showToast('画像指示を追加しました', 'success');
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const generatePromptsMutation = trpc.article.generateImagePrompts.useMutation({
    onSuccess: (data) => {
      setImagePrompts(data.prompts as ImagePromptData[]);
      showToast('画像プロンプトを生成しました', 'success');
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const generateSingleImageMutation = trpc.article.generateSingleImage.useMutation();

  useEffect(() => {
    if (articleQuery.data) {
      setMarkdown(articleQuery.data.markdownContent);
      setTitle(articleQuery.data.title);
      setSourceVideoUrl((articleQuery.data as Record<string, unknown>).sourceVideoUrl as string || '');
      setMetaDescription((articleQuery.data as Record<string, unknown>).metaDescription as string || '');
      setImages((articleQuery.data.images as SavedImage[] | null) ?? []);
    }
  }, [articleQuery.data]);

  const imageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of images) map.set(img.tag, img.base64);
    return map;
  }, [images]);

  const promptMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of imagePrompts) map.set(p.tag, p.englishPrompt);
    for (const img of images) {
      if (img.prompt && !map.has(img.tag)) map.set(img.tag, img.prompt);
    }
    return map;
  }, [imagePrompts, images]);

  /** Generate single image with auto-retry (up to MAX_RETRIES) */
  const handleGenerateSingleImage = async (tag: string) => {
    retryAbortRef.current.set(tag, false);
    setImageStatuses((prev) => new Map(prev).set(tag, 'generating'));
    setImageErrors((prev) => { const n = new Map(prev); n.delete(tag); return n; });
    setRetryInfo((prev) => new Map(prev).set(tag, { attempt: 1, max: MAX_RETRIES }));

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (retryAbortRef.current.get(tag)) break;

      setRetryInfo((prev) => new Map(prev).set(tag, { attempt, max: MAX_RETRIES }));

      try {
        const result = await generateSingleImageMutation.mutateAsync({ articleId, tag });
        setImages((prev) => {
          const filtered = prev.filter((img) => img.tag !== tag);
          return [...filtered, result.image as SavedImage];
        });
        setImageStatuses((prev) => new Map(prev).set(tag, 'completed'));
        setRetryInfo((prev) => { const n = new Map(prev); n.delete(tag); return n; });
        showToast('画像を生成しました', 'success');
        return; // Success - exit
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          // Final failure
          setImageStatuses((prev) => new Map(prev).set(tag, 'failed'));
          const msg = err instanceof Error ? err.message : '画像生成に失敗しました';
          setImageErrors((prev) => new Map(prev).set(tag, `生成失敗（${MAX_RETRIES}/${MAX_RETRIES}回試行済み）`));
          showToast(msg, 'error');
        }
      }
    }
  };

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      showToast('プロンプトをコピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  };

  const handleSave = useCallback(() => {
    updateMutation.mutate({ articleId, title, markdownContent: markdown, status: 'draft' });
  }, [articleId, title, markdown, updateMutation]);

  const [htmlCopied, setHtmlCopied] = useState(false);

  const handleCopyHtml = async () => {
    try {
      const html = markdownToWordPressHtml(markdown, imageMap, metaDescription);
      await navigator.clipboard.writeText(html);
      setHtmlCopied(true);
      setTimeout(() => setHtmlCopied(false), 1500);
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  };

  const handleDownloadImages = async () => {
    if (images.length === 0) return;
    try {
      const zip = new JSZip();
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        // Extract description from tag like [画像：description]
        const descMatch = img.tag.match(/^\[画像：(.+?)\]$/);
        const desc = descMatch ? descMatch[1] : `image_${i + 1}`;
        const fileName = `${String(i + 1).padStart(2, '0')}_${desc}.png`;
        // base64 data URL → raw binary
        const base64Data = img.base64.replace(/^data:image\/\w+;base64,/, '');
        zip.file(fileName, base64Data, { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || '記事'}_images.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${images.length}枚の画像をダウンロードしました`, 'success');
    } catch {
      showToast('ダウンロードに失敗しました', 'error');
    }
  };

  const handleGenerateImages = async () => {
    // Extract all image tags from markdown
    const tagMatches = markdown.match(/\[画像：.+?\]/g);
    if (!tagMatches || tagMatches.length === 0) return;

    setIsBulkGenerating(true);
    setBulkImageProgress({ current: 0, total: tagMatches.length });

    let successCount = 0;
    for (let i = 0; i < tagMatches.length; i++) {
      const tag = tagMatches[i];
      // Skip already generated images
      if (images.some((img) => img.tag === tag)) {
        successCount++;
        setBulkImageProgress({ current: i + 1, total: tagMatches.length });
        continue;
      }

      setImageStatuses((prev) => new Map(prev).set(tag, 'generating'));

      try {
        const result = await generateSingleImageMutation.mutateAsync({ articleId, tag });
        setImages((prev) => {
          const filtered = prev.filter((img) => img.tag !== tag);
          return [...filtered, result.image as SavedImage];
        });
        setImageStatuses((prev) => new Map(prev).set(tag, 'completed'));
        successCount++;
      } catch (err) {
        setImageStatuses((prev) => new Map(prev).set(tag, 'failed'));
        const msg = err instanceof Error ? err.message : '画像生成に失敗しました';
        setImageErrors((prev) => new Map(prev).set(tag, msg));
      }
      setBulkImageProgress({ current: i + 1, total: tagMatches.length });
    }

    setIsBulkGenerating(false);
    setBulkImageProgress(null);
    showToast(`${successCount}/${tagMatches.length}枚の画像を生成しました`, 'success');
  };

  const handleCopyMeta = async () => {
    try {
      await navigator.clipboard.writeText(metaDescription);
      showToast('メタディスクリプションをコピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  };

  // Word count
  const wordCount = useMemo(() => {
    const cleaned = markdown
      .replace(/^#+\s/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\n/g, '');
    return cleaned.length;
  }, [markdown]);

  // SEO keywords
  const seoKeywords = useMemo(() => extractKeywordsWithCount(markdown), [markdown]);

  // Check if article has image tags
  const hasImageTags = useMemo(() => /\[画像：.+?\]/.test(markdown), [markdown]);

  if (articleQuery.isLoading) {
    return <div className="text-center py-12 text-[#6B7280]">読み込み中...</div>;
  }
  if (articleQuery.error) {
    return <div className="text-center py-12 text-[#EF4444]">エラー: {articleQuery.error.message}</div>;
  }

  return (
    <div className="flex flex-col">
      <ToastContainer />

      {/* Header - Row 1: Back + Title + Save */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-2 sm:gap-3 pb-2 border-b border-[#E5E7EB]">
          <button onClick={() => navigate('/')} className="text-[#6B7280] hover:text-[#111827] flex-shrink-0 text-sm transition-colors">
            ← 戻る
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base sm:text-xl font-semibold text-[#111827] border-none outline-none bg-transparent min-w-0 flex-1"
          />
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 flex-shrink-0 font-medium"
          >
            保存
          </button>
        </div>

        {/* Source Video URL */}
        {sourceVideoUrl && (
          <div className="flex items-center gap-1.5 -mt-1">
            <svg className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
              <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/>
            </svg>
            <span className="text-xs text-[#6B7280]">元動画：</span>
            <a
              href={sourceVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#6B7280] hover:text-[#2563EB] hover:underline truncate"
            >
              {sourceVideoUrl}
            </a>
          </div>
        )}

        {/* Meta Description */}
        {metaDescription && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#6B7280] mb-0.5">メタディスクリプション</p>
                <p className="text-sm text-[#374151] leading-relaxed">{metaDescription}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-mono text-[#6B7280]">
                  {metaDescription.length}字
                  <span className="text-[10px] ml-1">（推奨: 120〜160字）</span>
                </span>
                <button onClick={handleCopyMeta} className="px-2 py-1 text-xs border border-[#E5E7EB] rounded-lg text-[#374151] hover:bg-[#F3F4F6]">
                  コピー
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => imageInstructionsMutation.mutate({ articleId })}
              disabled={imageInstructionsMutation.isPending}
              className="px-3 py-1.5 text-[13px] font-medium border border-[#E5E7EB] rounded-lg text-[#374151] bg-white hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
            >
              画像タグを挿入
            </button>
            <div className="relative group">
              <button
                onClick={handleGenerateImages}
                disabled={isBulkGenerating || !hasImageTags}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-lg flex items-center gap-1 transition-colors ${
                  hasImageTags
                    ? 'border border-[#2563EB] text-[#2563EB] bg-white hover:bg-[#EFF6FF] disabled:opacity-50'
                    : 'border border-[#E5E7EB] text-[#6B7280] bg-[#F3F4F6] cursor-not-allowed opacity-50'
                }`}
              >
                {isBulkGenerating
                  ? <><Spinner className="h-3 w-3" />生成中... {bulkImageProgress ? `${bulkImageProgress.current}/${bulkImageProgress.total}枚` : ''}</>
                  : '全画像を生成'
                }
              </button>
              {!hasImageTags && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block z-20 whitespace-nowrap px-2 py-1 text-[11px] text-white bg-[#374151] rounded-md">
                  先に画像指示を追加してください
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={handleDownloadImages}
              disabled={images.length === 0}
              className="px-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-lg text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              画像DL
            </button>
          </div>
        </div>

        {/* Mobile tab switcher */}
        <div className="lg:hidden flex items-center">
          <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden">
            <button
              onClick={() => setMobileTab('edit')}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${mobileTab === 'edit' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#6B7280]'}`}
            >
              編集
            </button>
            <button
              onClick={() => setMobileTab('preview')}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${mobileTab === 'preview' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#6B7280]'}`}
            >
              プレビュー
            </button>
          </div>
        </div>
      </div>

      {/* Editor and Preview - 3:7 ratio on desktop */}
      <div className="lg:flex lg:gap-4">
        {/* Markdown Editor - 3/10 width on desktop */}
        <div className={`flex flex-col lg:w-[30%] lg:min-w-[280px] ${mobileTab !== 'edit' ? 'hidden lg:flex' : ''}`}>
          <div className="text-xs text-[#6B7280] mb-1 hidden lg:block">Markdownエディタ</div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="w-full p-3 sm:p-4 border border-[#E5E7EB] rounded-xl text-sm resize-vertical outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB]"
            style={{ minHeight: '60vh', fontFamily: "'JetBrains Mono', 'Noto Sans JP', monospace" }}
            spellCheck={false}
          />
          {/* Word count */}
          <div className="mt-1 mb-4 lg:mb-0 text-xs flex items-center gap-1">
            <span className="text-[#6B7280]">現在：</span>
            <span className={`font-medium font-mono ${wordCount >= 3000 ? 'text-[#111827]' : 'text-[#EF4444]'}`}>
              {wordCount.toLocaleString()}字
            </span>
            <span className="text-[#6B7280]">／ 目標：3,000字以上</span>
          </div>
        </div>

        {/* Preview - 7/10 width on desktop */}
        <div className={`flex flex-col lg:w-[70%] ${mobileTab !== 'preview' ? 'hidden lg:flex' : ''}`}>
          <div className="text-xs text-[#6B7280] mb-1 hidden lg:block">HTMLプレビュー</div>
          <div className="relative p-4 sm:p-6 border border-[#E5E7EB] rounded-xl bg-white prose prose-gray max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h1:border-b prose-h1:border-[#E5E7EB] prose-h1:pb-2 prose-h1:mb-4 prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-p:leading-relaxed prose-li:my-0.5">
            {/* Floating copy icon */}
            <div className="not-prose sticky top-2 float-right z-10 group/copy">
            <button
              onClick={handleCopyHtml}
              className="w-8 h-8 flex items-center justify-center bg-white border border-[#E5E7EB] rounded-md shadow-sm hover:bg-[#F3F4F6] transition-colors"
            >
              {htmlCopied ? (
                <svg className="w-4 h-4 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              )}
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover/copy:block whitespace-nowrap px-2 py-1 text-[11px] text-white bg-[#374151] rounded-md">
              {htmlCopied ? 'コピーしました' : 'コピー'}
            </div>
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={buildMarkdownComponents(imageMap, promptMap, imageStatuses, imageErrors, retryInfo, handleGenerateSingleImage, handleCopyPrompt, generatePromptsMutation, articleId)}
            >
              {markdown}
            </ReactMarkdown>
          </div>

          {/* SEO Keywords Section */}
          {seoKeywords.length > 0 && (
            <div className="mt-2 p-3 bg-white border border-[#E5E7EB] rounded-xl">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-medium text-[#6B7280]">使用キーワード</p>
                <Tooltip text="記事内で使用されているキーワードとその出現頻度です。密度2〜3%が理想的です。" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {seoKeywords.map((kw) => {
                  const isSeoEffective = kw.density >= SEO_DENSITY_THRESHOLD;
                  return (
                    <span
                      key={kw.word}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                        isSeoEffective
                          ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#166534]'
                          : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#374151]'
                      }`}
                    >
                      {kw.word}
                      <span className={`text-[10px] ${isSeoEffective ? 'text-[#166534] opacity-70' : 'text-[#6B7280]'}`}>
                        {kw.count}回 {kw.density}%
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Build ReactMarkdown components with per-image generation + retry info
 */
function buildMarkdownComponents(
  imageMap: Map<string, string>,
  promptMap: Map<string, string>,
  imageStatuses: Map<string, ImageStatus>,
  imageErrors: Map<string, string>,
  retryInfo: Map<string, { attempt: number; max: number }>,
  onGenerateImage: (tag: string) => void,
  onCopyPrompt: (prompt: string) => void,
  generatePromptsMutation: { mutate: (input: { articleId: number }) => void; isPending: boolean },
  articleId: number,
) {
  return {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-2xl font-semibold border-b border-[#E5E7EB] pb-2 mb-4">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-xl font-semibold mt-8 mb-3 text-[#111827]">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-lg font-semibold mt-6 mb-2 text-[#111827]">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => {
      const text = String(children).trim();
      const imageMatch = text.match(/^\[画像：(.+?)\]$/);
      if (imageMatch) {
        const fullTag = text;
        const description = imageMatch[1];
        const dataUrl = imageMap.get(fullTag);
        const status = imageStatuses.get(fullTag) || 'idle';
        const error = imageErrors.get(fullTag);
        const retry = retryInfo.get(fullTag);

        if (dataUrl) {
          return (
            <figure className="my-4 not-prose">
              <img src={dataUrl} alt={description} className="w-full rounded-lg object-cover max-h-[500px]" />
              <figcaption className="text-center text-xs text-[#6B7280] mt-1">{description}</figcaption>
              {/* Regeneration button */}
              <div className="flex justify-center mt-2">
                <button
                  onClick={() => onGenerateImage(fullTag)}
                  disabled={status === 'generating'}
                  className="px-3 py-1 text-xs text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] disabled:opacity-50 flex items-center gap-1 transition-colors"
                >
                  {status === 'generating'
                    ? <><Spinner className="h-3 w-3" />{retry ? `リトライ中 ${retry.attempt}/${retry.max}` : '再生成中...'}</>
                    : '再生成'
                  }
                </button>
              </div>
            </figure>
          );
        }

        const prompt = promptMap.get(fullTag);
        const isGenerating = status === 'generating';

        return (
          <div className="my-3 border border-dashed border-[#E5E7EB] rounded-xl p-3 bg-[#F9FAFB] not-prose space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[#6B7280] text-base flex-shrink-0">&#x1f5bc;</span>
              <span className="text-xs text-[#374151] bg-white border border-[#E5E7EB] rounded px-2 py-0.5 truncate">
                {fullTag}
              </span>
            </div>

            {/* English prompt display */}
            {prompt && (
              <div className="bg-white border border-[#E5E7EB] rounded-lg p-2">
                <p className="text-[10px] text-[#6B7280] mb-1">English Prompt:</p>
                <p className="text-xs text-[#374151] leading-relaxed">{prompt}</p>
              </div>
            )}

            {/* Per-image action buttons */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onGenerateImage(fullTag)}
                disabled={isGenerating}
                className="px-3 py-1 text-[13px] bg-white border border-[#2563EB] text-[#2563EB] rounded-lg hover:bg-[#EFF6FF] disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {isGenerating
                  ? <><Spinner className="h-3 w-3" />{retry ? `リトライ中 ${retry.attempt}/${retry.max}` : '生成中...'}</>
                  : 'この画像を生成'
                }
              </button>
              {prompt && (
                <button
                  onClick={() => onCopyPrompt(prompt)}
                  className="px-3 py-1.5 text-xs border border-[#E5E7EB] text-[#374151] rounded-lg hover:bg-[#F3F4F6] transition-colors"
                >
                  プロンプトをコピー
                </button>
              )}
              {!prompt && (
                <button
                  onClick={() => generatePromptsMutation.mutate({ articleId })}
                  disabled={generatePromptsMutation.isPending}
                  className="px-3 py-1.5 text-xs border border-[#E5E7EB] text-[#374151] rounded-lg hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
                >
                  {generatePromptsMutation.isPending ? 'プロンプト生成中...' : 'プロンプトをコピー'}
                </button>
              )}
            </div>

            {/* Per-image error with retry exhausted */}
            {(status === 'failed' || error) && (
              <div className="text-xs text-[#6B7280] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-2 py-1.5">
                {error || '画像生成に失敗しました。'}プロンプトをコピーして
                <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="underline text-[#2563EB] ml-0.5">AI Studio</a>
                で生成してください。
              </div>
            )}
          </div>
        );
      }
      return <p>{children}</p>;
    },
  };
}
