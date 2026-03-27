import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/Toast';

interface SavedImage {
  tag: string;
  base64: string; // stored as data URI: "data:image/jpeg;base64,..."
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const articleId = Number(id);
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const [markdown, setMarkdown] = useState('');
  const [title, setTitle] = useState('');
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [images, setImages] = useState<SavedImage[]>([]);

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

  useEffect(() => {
    if (articleQuery.data) {
      setMarkdown(articleQuery.data.markdownContent);
      setTitle(articleQuery.data.title);
      setImages((articleQuery.data.images as SavedImage[] | null) ?? []);
    }
  }, [articleQuery.data]);

  // O(1) tag → dataUrl lookup
  const imageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of images) {
      map.set(img.tag, img.base64);
    }
    return map;
  }, [images]);

  const handleSave = useCallback(() => {
    updateMutation.mutate({ articleId, title, markdownContent: markdown, status: 'draft' });
  }, [articleId, title, markdown, updateMutation]);

  const handleComplete = () => {
    updateMutation.mutate({ articleId, title, markdownContent: markdown, status: 'completed' });
  };

  const handleCopyWordPress = async () => {
    try {
      let html = markdown;
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
      // Embed generated images or leave comment
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

  if (articleQuery.isLoading) {
    return <div className="text-center py-12 text-gray-500">読み込み中...</div>;
  }
  if (articleQuery.error) {
    return (
      <div className="text-center py-12 text-red-500">
        エラー: {articleQuery.error.message}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
            ← 戻る
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-bold text-gray-900 border-none outline-none bg-transparent"
          />
        </div>
        <div className="flex gap-2">
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
            {generateImagesMutation.isPending ? (
              <><Spinner className="h-3.5 w-3.5" />生成中...</>
            ) : '全画像を生成'}
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            保存
          </button>
          <button
            onClick={handleComplete}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            完成
          </button>
          <button
            onClick={handleCopyWordPress}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            WPコピー
          </button>
          <button
            onClick={() => setPreviewExpanded(!previewExpanded)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {previewExpanded ? '分割' : 'プレビュー拡大'}
          </button>
        </div>
      </div>

      {/* Editor and Preview */}
      <div className="flex gap-4 h-full">
        {/* Markdown Editor */}
        {!previewExpanded && (
          <div className="flex-1 flex flex-col">
            <div className="text-xs text-gray-500 mb-1">Markdownエディタ</div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="flex-1 w-full p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview */}
        <div className={previewExpanded ? 'w-full' : 'flex-1'}>
          <div className="text-xs text-gray-500 mb-1">HTMLプレビュー</div>
          <div className="h-full overflow-y-auto p-6 border border-gray-300 rounded-lg bg-white prose prose-sm max-w-none">
            <div className="not-prose mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              ※ AI生成コンテンツです。公開前に内容・数字・固有名詞を必ずご確認ください
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => {
                  const text = String(children).trim();
                  const imageMatch = text.match(/^\[画像：(.+?)\]$/);
                  if (imageMatch) {
                    const fullTag = text;
                    const description = imageMatch[1];
                    const dataUrl = imageMap.get(fullTag);

                    if (dataUrl) {
                      // Show generated image inline
                      return (
                        <figure className="my-4 not-prose">
                          <img
                            src={dataUrl}
                            alt={description}
                            className="w-full rounded-lg object-cover max-h-80"
                          />
                          <figcaption className="text-center text-xs text-gray-400 mt-1">
                            {description}
                          </figcaption>
                        </figure>
                      );
                    }

                    // Placeholder with per-tag generate button
                    return (
                      <div className="my-3 border-2 border-dashed border-gray-200 rounded-lg p-3 bg-gray-50 flex items-center justify-between gap-3 not-prose">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-300 text-lg flex-shrink-0">🖼</span>
                          <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-0.5 truncate">
                            {fullTag}
                          </span>
                        </div>
                        <button
                          onClick={handleGenerateImages}
                          disabled={generateImagesMutation.isPending}
                          className="flex-shrink-0 px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {generateImagesMutation.isPending
                            ? <><Spinner className="h-3 w-3" />生成中...</>
                            : '画像を生成'
                          }
                        </button>
                      </div>
                    );
                  }
                  return <p>{children}</p>;
                },
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
