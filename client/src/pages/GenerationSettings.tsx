import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/Toast';
import {
  extractVideoId,
  fetchTranscriptFromBrowser,
} from '../lib/youtubeTranscript';

type TranscriptStatus = 'idle' | 'fetching' | 'success' | 'failed';

export default function GenerationSettings() {
  const [searchParams] = useSearchParams();
  const videoUrl = searchParams.get('url') || '';
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const [articleLength, setArticleLength] = useState<'standard' | 'long'>(
    'standard',
  );
  const [keywordsText, setKeywordsText] = useState('');
  const [transcriptStatus, setTranscriptStatus] =
    useState<TranscriptStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const generateMutation = trpc.article.generate.useMutation({
    onSuccess: (data) => {
      showToast('記事を生成しました！', 'success');
      navigate(`/editor/${data.articleId}`);
    },
    onError: (err) => {
      setStatusMessage('');
      setTranscriptStatus('idle');
      showToast(err.message, 'error');
    },
  });

  useEffect(() => {
    if (!videoUrl) navigate('/');
  }, [videoUrl, navigate]);

  const handleGenerate = async () => {
    const seoKeywords = keywordsText
      .split(/[,、]/)
      .map((k) => k.trim())
      .filter(Boolean);

    // Step 1: Try fetching transcript from browser
    setTranscriptStatus('fetching');
    setStatusMessage('字幕を取得中...');

    let transcript: string | null = null;
    const videoId = extractVideoId(videoUrl);

    if (videoId) {
      try {
        transcript = await fetchTranscriptFromBrowser(videoId);
      } catch {
        console.warn('[Generate] Browser transcript fetch failed');
      }
    }

    if (transcript) {
      setTranscriptStatus('success');
      setStatusMessage('字幕取得完了！記事を生成中...');
    } else {
      setTranscriptStatus('failed');
      setStatusMessage('字幕取得できませんでした。メタデータベースで生成します...');
    }

    // Step 2: Send to backend with transcript (or null)
    generateMutation.mutate({
      videoUrl,
      articleLength,
      seoKeywords,
      transcript: transcript || undefined,
    });
  };

  const isProcessing =
    generateMutation.isPending || transcriptStatus === 'fetching';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ToastContainer />

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← 戻る
        </button>
        <h2 className="text-2xl font-bold text-gray-900">生成設定</h2>
      </div>

      {/* Video URL */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        対象動画: {videoUrl}
      </div>

      {/* Article Length */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">記事の長さ</h3>
        <div className="flex gap-3">
          <label className="flex-1 flex items-center gap-2 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={articleLength === 'standard'}
              onChange={() => setArticleLength('standard')}
              className="text-blue-600"
            />
            <span className="text-sm">スタンダード（約3,000文字）</span>
          </label>
          <label className="flex-1 flex items-center gap-2 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={articleLength === 'long'}
              onChange={() => setArticleLength('long')}
              className="text-blue-600"
            />
            <span className="text-sm">ロング（5,000文字以上）</span>
          </label>
        </div>
      </div>

      {/* SEO Keywords */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">
          ターゲットキーワード（任意）
        </h3>
        <input
          type="text"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          placeholder="例：スーツ, 着こなし, マナー"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          カンマ区切りで複数入力できます
        </p>
      </div>

      {/* Status message */}
      {statusMessage && (
        <div
          className={`rounded-lg p-3 text-sm ${
            transcriptStatus === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : transcriptStatus === 'failed'
                ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          <span className="flex items-center gap-2">
            {transcriptStatus === 'fetching' && (
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {statusMessage}
          </span>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isProcessing}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            生成中... (数分かかる場合があります)
          </span>
        ) : (
          '生成開始'
        )}
      </button>
    </div>
  );
}
