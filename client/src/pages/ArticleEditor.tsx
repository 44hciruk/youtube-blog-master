import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/Toast';

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const articleId = Number(id);
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const [markdown, setMarkdown] = useState('');
  const [title, setTitle] = useState('');
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

  useEffect(() => {
    if (articleQuery.data) {
      setMarkdown(articleQuery.data.markdownContent);
      setTitle(articleQuery.data.title);
    }
  }, [articleQuery.data]);

  const handleSave = useCallback(() => {
    updateMutation.mutate({
      articleId,
      title,
      markdownContent: markdown,
      status: 'draft',
    });
  }, [articleId, title, markdown, updateMutation]);

  const handleComplete = () => {
    updateMutation.mutate({
      articleId,
      title,
      markdownContent: markdown,
      status: 'completed',
    });
  };

  const handleCopyWordPress = async () => {
    try {
      // Simple markdown to WordPress HTML conversion on client
      let html = markdown;
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
      html = html.replace(/\[画像：(.+?)\]/g, '<!-- 画像挿入: $1 -->');

      await navigator.clipboard.writeText(html);
      showToast('WordPressへコピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  };

  const handleAddImageInstructions = () => {
    imageInstructionsMutation.mutate({ articleId });
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

  // Custom renderer for image instructions highlight
  const ImageHighlight = ({ text }: { text: string }) => (
    <span className="bg-yellow-100 border border-yellow-300 rounded px-2 py-1 text-yellow-800 text-sm inline-block my-1">
      {text}
    </span>
  );

  return (
    <div className="h-[calc(100vh-8rem)]">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-700"
          >
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
            onClick={handleAddImageInstructions}
            disabled={imageInstructionsMutation.isPending}
            className="px-3 py-2 text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:opacity-50"
          >
            画像指示追加
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
      <div className={`flex gap-4 h-full ${previewExpanded ? '' : ''}`}>
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => {
                  // Check if content contains image instruction
                  const text = String(children);
                  const imageMatch = text.match(/\[画像：(.+?)\]/);
                  if (imageMatch) {
                    return (
                      <p>
                        <ImageHighlight text={text} />
                      </p>
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
