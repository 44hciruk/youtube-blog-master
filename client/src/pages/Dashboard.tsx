import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { ArticleTable } from '../components/ArticleTable';
import { useToast } from '../components/Toast';

export default function Dashboard() {
  const [videoUrl, setVideoUrl] = useState('');
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const articlesQuery = trpc.article.list.useQuery({});
  const deleteMutation = trpc.article.delete.useMutation({
    onSuccess: () => {
      showToast('記事を削除しました', 'success');
      articlesQuery.refetch();
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const exportQuery = trpc.article.export.useQuery(
    { articleId: 0, format: 'markdown' },
    { enabled: false },
  );

  const handleGenerate = () => {
    if (!videoUrl.trim()) {
      showToast('YouTube URLを入力してください', 'error');
      return;
    }
    navigate(`/generate?url=${encodeURIComponent(videoUrl)}`);
  };

  const handleEdit = (articleId: number) => {
    navigate(`/editor/${articleId}`);
  };

  const handleDelete = (articleId: number) => {
    if (window.confirm('この記事を削除しますか？')) {
      deleteMutation.mutate({ articleId });
    }
  };

  const handleExport = async (articleId: number, format: 'markdown' | 'wordpress') => {
    try {
      const result = await exportQuery.refetch();
      // Use a direct fetch for export since we need dynamic params
      const res = await fetch(
        `/api/trpc/article.export?input=${encodeURIComponent(
          JSON.stringify({ articleId, format }),
        )}`,
        { headers: { 'x-user-id': '1' } },
      );
      const data = await res.json();
      const exportData = data.result?.data;
      if (exportData?.content) {
        const blob = new Blob([exportData.content], { type: exportData.mimeType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportData.filename || 'export.md';
        a.click();
        URL.revokeObjectURL(url);
        showToast('エクスポートしました', 'success');
      }
    } catch {
      showToast('エクスポートに失敗しました', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <ToastContainer />

      {/* URL Input Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          新しい記事を生成
        </h2>
        <div className="flex gap-3">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            生成開始
          </button>
        </div>
      </div>

      {/* Articles List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          過去に生成した記事
        </h2>
        {articlesQuery.isLoading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : articlesQuery.error ? (
          <div className="text-center py-8 text-red-500">
            エラー: {articlesQuery.error.message}
          </div>
        ) : (
          <ArticleTable
            articles={articlesQuery.data?.articles || []}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onExport={handleExport}
          />
        )}
      </div>
    </div>
  );
}
