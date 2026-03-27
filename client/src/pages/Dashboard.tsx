import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { ArticleTable } from '../components/ArticleTable';
import { useToast } from '../components/Toast';

const STEP_LABELS: Record<string, string> = {
  fetching_video: '動画情報を取得中...',
  fetching_transcript: '字幕を取得中...',
  generating_article: 'AIが記事を生成中...',
  saving_article: '記事を保存中...',
  completed: '完了！',
  error: 'エラーが発生しました',
};

const STEP_ORDER = ['fetching_video', 'fetching_transcript', 'generating_article', 'saving_article'];

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

  // Progress polling (every 2 seconds, only when generating)
  const [isGenerating, setIsGenerating] = useState(false);
  const progressQuery = trpc.article.getProgress.useQuery(undefined, {
    enabled: isGenerating,
    refetchInterval: isGenerating ? 2000 : false,
  });

  const generateMutation = trpc.article.generate.useMutation({
    onMutate: () => setIsGenerating(true),
    onSuccess: (data) => {
      setIsGenerating(false);
      showToast('記事を生成しました！', 'success');
      articlesQuery.refetch();
      navigate(`/editor/${data.articleId}`);
    },
    onError: (err) => {
      setIsGenerating(false);
      showToast(err.message, 'error');
    },
  });

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
      const userId = localStorage.getItem('userId') || '1';
      const res = await fetch(
        `/api/trpc/article.export?input=${encodeURIComponent(
          JSON.stringify({ articleId, format }),
        )}`,
        { headers: { 'x-user-id': userId } },
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

  const currentStep = progressQuery.data?.step || 'idle';

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

      {/* Progress Display */}
      {isGenerating && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-4">生成進捗</h3>
          <div className="space-y-3">
            {STEP_ORDER.map((step, idx) => {
              const currentIdx = STEP_ORDER.indexOf(currentStep);
              const isActive = step === currentStep;
              const isDone = currentIdx > idx || currentStep === 'completed';
              const isPending = currentIdx < idx;

              return (
                <div key={step} className="flex items-center gap-3">
                  {/* Status icon */}
                  {isDone ? (
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  ) : isActive ? (
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                  ) : (
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200" />
                  )}

                  {/* Label */}
                  <span className={`text-sm ${isActive ? 'text-blue-700 font-medium' : isDone ? 'text-green-700' : 'text-gray-400'}`}>
                    {STEP_LABELS[step]}
                  </span>
                </div>
              );
            })}
          </div>
          {currentStep === 'error' && progressQuery.data?.message && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {progressQuery.data.message}
            </div>
          )}
        </div>
      )}

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
