import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { ArticleTable } from '../components/ArticleTable';
import { useToast } from '../components/Toast';
import { Tooltip } from '../components/Tooltip';
import { CostDashboard } from '../components/CostDashboard';

const STEP_LABELS: Record<string, string> = {
  fetching_video: '動画情報を取得中...',
  fetching_transcript: '字幕を取得中...',
  generating_article: 'AIが記事を生成中...',
  saving_article: '記事を保存中...',
  completed: '完了！',
  error: 'エラーが発生しました',
};

const STEP_ORDER = ['fetching_video', 'fetching_transcript', 'generating_article', 'saving_article'];

type SortOrder = 'newest' | 'oldest';
type ToneOption = 'casual' | 'polite' | 'professional';

export default function Dashboard() {
  const [videoUrl, setVideoUrl] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [showManualTranscript, setShowManualTranscript] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [tone, setTone] = useState<ToneOption>('polite');
  const [showDeleteModal, setShowDeleteModal] = useState<number | null>(null);
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
    const params = new URLSearchParams({ url: videoUrl });
    if (manualTranscript.trim()) {
      params.set('transcript', manualTranscript.trim());
    }
    params.set('tone', tone);
    navigate(`/generate?${params.toString()}`);
  };

  const handleEdit = (articleId: number) => {
    navigate(`/editor/${articleId}`);
  };

  const handleDelete = (articleId: number) => {
    setShowDeleteModal(articleId);
  };

  const confirmDelete = () => {
    if (showDeleteModal !== null) {
      deleteMutation.mutate({ articleId: showDeleteModal });
      setShowDeleteModal(null);
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

  // Sort articles and limit to 10
  const allArticles = articlesQuery.data?.articles || [];
  const filteredArticles = allArticles
    .sort((a, b) => {
      const dateA = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
      const dateB = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    })
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <ToastContainer />

      {/* URL Input Section - compact */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
        <h2 className="text-sm font-semibold text-[#111827] mb-3">新しい記事を生成</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2">
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none text-[#111827] text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
            <Tooltip text="YouTubeの動画URLを貼り付けてください。通常動画・ショート両対応です。" />
          </div>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-[#2563EB] text-white rounded-lg font-medium text-sm hover:bg-[#1D4ED8] transition-colors whitespace-nowrap"
          >
            生成開始
          </button>
        </div>

        {/* Manual Transcript Input */}
        <div className="mt-2">
          <button
            onClick={() => setShowManualTranscript(!showManualTranscript)}
            className="flex items-center gap-2 text-xs text-[#6B7280] hover:text-[#111827]"
          >
            <svg className={`w-3 h-3 transition-transform ${showManualTranscript ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            字幕テキストを手動入力する（任意）
            <Tooltip text="字幕があると記事の精度が上がります。YouTubeの文字起こし機能からコピーして貼り付けてください。" />
          </button>
          {showManualTranscript && (
            <div className="mt-2 space-y-2">
              <textarea
                value={manualTranscript}
                onChange={(e) => setManualTranscript(e.target.value)}
                placeholder="YouTubeの文字起こしテキストをここに貼り付けてください..."
                rows={4}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none text-sm resize-y"
              />
              <p className="text-xs text-[#6B7280]">
                YouTubeの動画ページで「...」→「文字起こし」を開き、テキストをコピーして貼り付けてください。
              </p>
            </div>
          )}
        </div>

        {/* Tone Selector */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-[#6B7280]">トーン：</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as ToneOption)}
            className="text-xs px-2 py-1 border border-[#E5E7EB] rounded-lg bg-white text-[#374151]"
          >
            <option value="casual">カジュアル</option>
            <option value="polite">丁寧語</option>
            <option value="professional">専門的</option>
          </select>
        </div>
      </div>

      {/* Progress Display */}
      {isGenerating && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
          <h3 className="text-sm font-semibold text-[#111827] mb-3">生成進捗</h3>
          <div className="space-y-2.5">
            {STEP_ORDER.map((step, idx) => {
              const currentIdx = STEP_ORDER.indexOf(currentStep);
              const isActive = step === currentStep;
              const isDone = currentIdx > idx || currentStep === 'completed';

              return (
                <div key={step} className="flex items-center gap-3">
                  {isDone ? (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  ) : isActive ? (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#2563EB] flex items-center justify-center">
                      <svg className="animate-spin w-3 h-3 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                  ) : (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-[#E5E7EB]" />
                  )}
                  <span className={`text-sm ${isActive ? 'text-[#111827] font-medium' : isDone ? 'text-[#6B7280]' : 'text-[#D1D5DB]'}`}>
                    {STEP_LABELS[step]}
                  </span>
                </div>
              );
            })}
          </div>
          {currentStep === 'error' && progressQuery.data?.message && (
            <div className="mt-3 text-sm text-[#EF4444] bg-red-50 border border-red-100 p-3 rounded-lg">
              {progressQuery.data.message}
            </div>
          )}
        </div>
      )}

      {/* Cost Dashboard */}
      <CostDashboard />

      {/* Articles List */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#111827]">過去に生成した記事</h2>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="text-xs px-2 py-1 border border-[#E5E7EB] rounded-lg bg-white text-[#6B7280]"
          >
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
          </select>
        </div>
        {articlesQuery.isLoading ? (
          <div className="text-center py-8 text-[#6B7280] text-sm">読み込み中...</div>
        ) : articlesQuery.error ? (
          <div className="text-center py-8 text-[#EF4444] text-sm">
            エラー: {articlesQuery.error.message}
          </div>
        ) : (
          <>
            <ArticleTable
              articles={filteredArticles}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onExport={handleExport}
            />
            {allArticles.length > 10 && (
              <p className="text-xs text-[#6B7280] mt-2 text-center">
                最新10件を表示中（全{allArticles.length}件）
              </p>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-[#111827] mb-2">記事の削除</h3>
            <p className="text-sm text-[#6B7280] mb-5">この記事を削除しますか？元に戻せません。</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-sm border border-[#E5E7EB] rounded-lg text-[#374151] hover:bg-[#F3F4F6] transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
