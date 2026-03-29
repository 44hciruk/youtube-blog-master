import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/Toast';
import { Tooltip } from '../components/Tooltip';
import {
  extractVideoId,
  fetchTranscriptViaWorker,
} from '../lib/youtubeTranscript';

type TranscriptStatus = 'idle' | 'fetching' | 'success' | 'failed';

export default function GenerationSettings() {
  const [searchParams] = useSearchParams();
  const videoUrl = searchParams.get('url') || '';
  const manualTranscript = searchParams.get('transcript') || '';
  const toneParam = searchParams.get('tone') || 'polite';
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const [articleLength, setArticleLength] = useState<'standard' | 'long'>('standard');
  const [keywordsText, setKeywordsText] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualText, setManualText] = useState(manualTranscript || '');
  const [fetchedTranscript, setFetchedTranscript] = useState<string | null>(null);

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

  // Auto-fetch transcript on mount
  useEffect(() => {
    if (manualTranscript.length > 50) return; // Manual transcript provided, skip auto-fetch

    const fetchTranscript = async () => {
      const videoId = extractVideoId(videoUrl);
      if (!videoId) return;

      setTranscriptStatus('fetching');
      setStatusMessage('字幕を取得中...');

      // Fetch via Cloudflare Worker (sole transcript source)
      const workerResult = await fetchTranscriptViaWorker(videoId);
      if (workerResult.text) {
        setFetchedTranscript(workerResult.text);
        setTranscriptStatus('success');
        setStatusMessage(`字幕を取得しました（${workerResult.text.length.toLocaleString()}文字）`);
        return;
      }

      // Worker failed
      setTranscriptStatus('failed');
      setStatusMessage('');
      setShowManualFallback(true);
      showToast('字幕がオフの動画です。手動ペーストまたはメタデータのみで生成します', 'error');
    };

    fetchTranscript();
  }, [videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    const seoKeywords = keywordsText
      .split(/[,、]/)
      .map((k) => k.trim())
      .filter(Boolean);

    // Determine transcript source
    let transcript: string | undefined;

    if (manualTranscript.length > 50) {
      transcript = manualTranscript;
      setStatusMessage('手動入力の字幕を使用して生成中...');
    } else if (manualText.trim().length > 50) {
      transcript = manualText.trim();
      setStatusMessage('手動ペーストの字幕を使用して生成中...');
    } else if (fetchedTranscript) {
      transcript = fetchedTranscript;
      setStatusMessage('記事を生成中（字幕あり）...');
    } else {
      setStatusMessage('記事を生成中...');
    }

    setTranscriptStatus(transcript ? 'success' : 'failed');

    generateMutation.mutate({
      videoUrl,
      tone: toneParam as 'casual' | 'polite' | 'professional',
      articleLength,
      seoKeywords,
      transcript: transcript || undefined,
    });
  };

  const handleGenerateWithoutTranscript = () => {
    const seoKeywords = keywordsText
      .split(/[,、]/)
      .map((k) => k.trim())
      .filter(Boolean);

    setTranscriptStatus('failed');
    setStatusMessage('記事を生成中...');

    generateMutation.mutate({
      videoUrl,
      tone: toneParam as 'casual' | 'polite' | 'professional',
      articleLength,
      seoKeywords,
    });
  };

  const isProcessing = generateMutation.isPending || transcriptStatus === 'fetching';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ToastContainer />

      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
          ← 戻る
        </button>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">生成設定</h2>
      </div>

      {/* Video URL */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 break-all">
        対象動画: {videoUrl}
      </div>

      {/* Transcript status */}
      {manualTranscript && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          手動入力の字幕テキストを使用します（{manualTranscript.length}文字）
        </div>
      )}

      {!manualTranscript && transcriptStatus === 'success' && statusMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          {statusMessage}
        </div>
      )}

      {!manualTranscript && transcriptStatus === 'fetching' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            字幕を取得中...
          </span>
        </div>
      )}

      {/* Manual fallback area */}
      {showManualFallback && !manualTranscript && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <p className="text-sm text-yellow-800">
            字幕の自動取得に失敗しました。YouTubeの「文字起こし」からテキストをコピーして貼り付けると、記事の精度が向上します。
          </p>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="字幕テキストを貼り付け（任意）..."
            className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm resize-vertical outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-white"
            rows={4}
          />
          <button
            onClick={handleGenerateWithoutTranscript}
            disabled={isProcessing}
            className="w-full py-2 text-sm border border-yellow-400 text-yellow-800 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-50"
          >
            字幕なしで生成する
          </button>
        </div>
      )}

      {/* Article Length */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-gray-900">記事の長さ</h3>
          <Tooltip text="スタンダード（3,000字）はSEOの基本的な長さです。ロング（5,000字+）は競合が多いキーワードに効果的です。" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-gray-900">ターゲットキーワード（任意）</h3>
          <Tooltip text="狙いたい検索キーワードを入力してください。例：スーツ 着こなし、ネイビースーツ コーデ\nカンマ区切りで複数入力できます。" />
        </div>
        <input
          type="text"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          placeholder="例：スーツ, 着こなし, マナー"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        />
      </div>

      {/* Status message during generation */}
      {generateMutation.isPending && statusMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
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
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
