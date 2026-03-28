import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const articleId = Number(id);
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const [markdown, setMarkdown] = useState('');
  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [images, setImages] = useState<SavedImage[]>([]);
  const [imagePrompts, setImagePrompts] = useState<ImagePromptData[]>([]);
  const [imageStatuses, setImageStatuses] = useState<Map<string, ImageStatus>>(new Map());
  const [imageErrors, setImageErrors] = useState<Map<string, string>>(new Map());
  // Mobile: tab switch; Desktop: side-by-side or expanded
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [previewExpanded, setPreviewExpanded] = useState(false);

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

  const generateImagesMutation = trpc.article.generateImages.useMutation({
    onSuccess: (data) => {
      setImages(data.images as SavedImage[]);
      showToast(`${data.count}枚の画像を生成しました`, 'success');
    },
    onError: (err) => showToast(err.message, 'error'),
  });

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
    // Also include prompts returned with generated images
    for (const img of images) {
      if (img.prompt && !map.has(img.tag)) map.set(img.tag, img.prompt);
    }
    return map;
  }, [imagePrompts, images]);

  const handleGenerateSingleImage = async (tag: string) => {
    setImageStatuses((prev) => new Map(prev).set(tag, 'generating'));
    setImageErrors((prev) => {
      const next = new Map(prev);
      next.delete(tag);
      return next;
    });

    try {
      const result = await generateSingleImageMutation.mutateAsync({ articleId, tag });
      setImages((prev) => {
        const filtered = prev.filter((img) => img.tag !== tag);
        return [...filtered, result.image as SavedImage];
      });
      setImageStatuses((prev) => new Map(prev).set(tag, 'completed'));
      showToast('画像を生成しました', 'success');
    } catch (err) {
      setImageStatuses((prev) => new Map(prev).set(tag, 'failed'));
      const msg = err instanceof Error ? err.message : '画像生成に失敗しました';
      setImageErrors((prev) => new Map(prev).set(tag, msg));
      showToast(msg, 'error');
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

  const handleCopyWordPress = async () => {
    try {
      let html = markdown;
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
      html = html.replace(/\[画像：(.+?)\]/g, (match) => {
        const dataUrl = imageMap.get(match);
        return dataUrl
          ? `<img src="${dataUrl}" alt="${match.slice(4, -1)}" />`
          : `<!-- 画像挿入: ${match.slice(4, -1)} -->`;
      });
      await navigator.clipboard.writeText(html);
      showToast('WordPressへコピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  };

  const handleGenerateImages = () => {
    generateImagesMutation.mutate({ articleId });
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

  if (articleQuery.isLoading) {
    return <div className="text-center py-12 text-gray-500">読み込み中...</div>;
  }
  if (articleQuery.error) {
    return <div className="text-center py-12 text-red-500">エラー: {articleQuery.error.message}</div>;
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <ToastContainer />

      {/* Fullscreen preview modal */}
      {previewExpanded && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">HTMLプレビュー</span>
            <button
              onClick={() => setPreviewExpanded(false)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              閉じる
            </button>
          </div>
          <div className="max-w-4xl mx-auto p-6 sm:p-8 prose prose-gray max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-2 prose-h1:mb-4 prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-p:leading-relaxed prose-li:my-0.5">
            <div className="not-prose mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              ※ AI生成コンテンツです。公開前に内容・数字・固有名詞を必ずご確認ください
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents(imageMap, promptMap, imageStatuses, imageErrors, handleGenerateSingleImage, handleCopyPrompt, generatePromptsMutation, articleId)}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 flex-shrink-0 text-sm">
              ← 戻る
            </button>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base sm:text-xl font-bold text-gray-900 border-none outline-none bg-transparent min-w-0 flex-1"
            />
          </div>
          {/* Desktop buttons */}
          <div className="hidden lg:flex gap-2 flex-shrink-0">
            <button
              onClick={() => imageInstructionsMutation.mutate({ articleId })}
              disabled={imageInstructionsMutation.isPending}
              className="px-3 py-2 text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:opacity-50"
            >
              画像指示追加
            </button>
            <button
              onClick={handleGenerateImages}
              disabled={generateImagesMutation.isPending}
              className="px-3 py-2 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5"
            >
              {generateImagesMutation.isPending ? <><Spinner className="h-3.5 w-3.5" />生成中...</> : '全画像を生成'}
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              保存
            </button>
            <div className="relative">
              <button
                onClick={handleCopyWordPress}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
              >
                WPコピー
                <Tooltip text="WordPressの投稿画面でHTMLモードにして貼り付けてください。" />
              </button>
            </div>
            <button
              onClick={() => setPreviewExpanded(true)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              プレビュー拡大
            </button>
          </div>
          {/* Mobile buttons */}
          <div className="flex lg:hidden gap-1.5 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              保存
            </button>
            <button
              onClick={handleCopyWordPress}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              WP
            </button>
          </div>
        </div>

        {/* Meta Description */}
        {metaDescription && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 mb-0.5">メタディスクリプション</p>
                <p className="text-sm text-gray-700 leading-relaxed">{metaDescription}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs ${metaDescription.length >= 100 && metaDescription.length <= 120 ? 'text-green-600' : 'text-amber-600'}`}>
                  {metaDescription.length}字
                </span>
                <button onClick={handleCopyMeta} className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50">
                  コピー
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile tab switcher + extra buttons */}
        <div className="lg:hidden flex items-center justify-between">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setMobileTab('edit')}
              className={`px-4 py-1.5 text-xs font-medium ${mobileTab === 'edit' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              編集
            </button>
            <button
              onClick={() => setMobileTab('preview')}
              className={`px-4 py-1.5 text-xs font-medium ${mobileTab === 'preview' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              プレビュー
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => imageInstructionsMutation.mutate({ articleId })}
              disabled={imageInstructionsMutation.isPending}
              className="px-2 py-1 text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100 disabled:opacity-50"
            >
              画像指示
            </button>
            <button
              onClick={handleGenerateImages}
              disabled={generateImagesMutation.isPending}
              className="px-2 py-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 disabled:opacity-50"
            >
              全画像生成
            </button>
          </div>
        </div>
      </div>

      {/* Editor and Preview - 3:7 ratio */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Markdown Editor - 3/10 width on desktop */}
        <div className={`flex flex-col ${previewExpanded ? 'hidden' : 'lg:w-[30%] lg:min-w-[280px]'} ${mobileTab !== 'edit' ? 'hidden lg:flex' : 'flex-1 lg:flex-none'}`}>
          <div className="text-xs text-gray-500 mb-1 hidden lg:block">Markdownエディタ</div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="flex-1 w-full p-3 sm:p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            spellCheck={false}
          />
          {/* Word count */}
          <div className="mt-1 text-xs flex items-center gap-1">
            <span className="text-gray-500">現在：</span>
            <span className={wordCount >= 3000 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
              {wordCount.toLocaleString()}字
            </span>
            <span className="text-gray-400">／ 目標：3,000字以上</span>
          </div>
        </div>

        {/* Preview - 7/10 width on desktop, min-height 80vh */}
        <div className={`flex flex-col ${previewExpanded ? 'hidden' : 'lg:w-[70%]'} ${mobileTab !== 'preview' ? 'hidden lg:flex' : 'flex-1 lg:flex-none'}`}>
          <div className="text-xs text-gray-500 mb-1 hidden lg:block">HTMLプレビュー</div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 border border-gray-300 rounded-lg bg-white prose prose-gray max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-2 prose-h1:mb-4 prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-p:leading-relaxed prose-li:my-0.5" style={{ minHeight: '80vh' }}>
            <div className="not-prose mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              ※ AI生成コンテンツです。公開前に内容・数字・固有名詞を必ずご確認ください
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents(imageMap, promptMap, imageStatuses, imageErrors, handleGenerateSingleImage, handleCopyPrompt, generatePromptsMutation, articleId)}
            >
              {markdown}
            </ReactMarkdown>
          </div>

          {/* SEO Keywords Section */}
          {seoKeywords.length > 0 && (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-medium text-gray-600">使用キーワード</p>
                <Tooltip text="記事内で使用されているキーワードとその出現頻度です。密度2〜3%が理想的です。" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {seoKeywords.map((kw) => (
                  <span
                    key={kw.word}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                      kw.density >= 2 && kw.density <= 3
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-gray-100 border-gray-200 text-gray-600'
                    }`}
                  >
                    {kw.word}
                    <span className="text-[10px] opacity-70">{kw.count}回 {kw.density}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Build ReactMarkdown components with per-image generation support
 */
function markdownComponents(
  imageMap: Map<string, string>,
  promptMap: Map<string, string>,
  imageStatuses: Map<string, ImageStatus>,
  imageErrors: Map<string, string>,
  onGenerateImage: (tag: string) => void,
  onCopyPrompt: (prompt: string) => void,
  generatePromptsMutation: { mutate: (input: { articleId: number }) => void; isPending: boolean },
  articleId: number,
) {
  return {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-2xl font-bold border-b border-gray-200 pb-2 mb-4">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-800">{children}</h3>
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

        if (dataUrl) {
          return (
            <figure className="my-4 not-prose">
              <img src={dataUrl} alt={description} className="w-full rounded-lg object-cover max-h-[500px]" />
              <figcaption className="text-center text-xs text-gray-400 mt-1">{description}</figcaption>
              {/* Allow regeneration */}
              <div className="flex justify-center mt-2">
                <button
                  onClick={() => onGenerateImage(fullTag)}
                  disabled={status === 'generating'}
                  className="px-3 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                >
                  {status === 'generating' ? <><Spinner className="h-3 w-3" />再生成中...</> : '再生成'}
                </button>
              </div>
            </figure>
          );
        }

        const prompt = promptMap.get(fullTag);
        const isGenerating = status === 'generating';

        return (
          <div className="my-3 border-2 border-dashed border-gray-200 rounded-lg p-3 bg-gray-50 not-prose space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-lg flex-shrink-0">🖼</span>
              <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-0.5 truncate">
                {fullTag}
              </span>
            </div>

            {/* English prompt display */}
            {prompt && (
              <div className="bg-white border border-gray-200 rounded p-2">
                <p className="text-[10px] text-gray-400 mb-1">English Prompt:</p>
                <p className="text-xs text-gray-600 leading-relaxed">{prompt}</p>
              </div>
            )}

            {/* Per-image action buttons */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onGenerateImage(fullTag)}
                disabled={isGenerating}
                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isGenerating
                  ? <><Spinner className="h-3 w-3" />生成中...</>
                  : 'この画像を生成'
                }
              </button>
              {prompt && (
                <button
                  onClick={() => onCopyPrompt(prompt)}
                  className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  プロンプトをコピー
                </button>
              )}
              {!prompt && (
                <button
                  onClick={() => generatePromptsMutation.mutate({ articleId })}
                  disabled={generatePromptsMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                >
                  {generatePromptsMutation.isPending ? 'プロンプト生成中...' : 'プロンプト生成'}
                </button>
              )}
            </div>

            {/* Per-image error */}
            {(status === 'failed' || error) && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                画像生成に失敗しました。プロンプトをコピーして
                <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="underline ml-0.5">AI Studio</a>
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
