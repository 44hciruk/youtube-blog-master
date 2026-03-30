import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/Toast';
import { Tooltip } from '../components/Tooltip';
import { cleanTranscriptText } from '../lib/youtubeTranscript';

export default function GenerationSettings() {
  const [searchParams] = useSearchParams();
  const videoUrl = searchParams.get('url') || '';
  const passedTranscript = searchParams.get('transcript') || '';
  const toneParam = searchParams.get('tone') || 'polite';
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const [articleLength, setArticleLength] = useState<'standard' | 'long'>('standard');
  const [keywordsText, setKeywordsText] = useState('');
  const [transcriptText, setTranscriptText] = useState(passedTranscript || '');
  const [showGuide, setShowGuide] = useState(false);

  const generateMutation = trpc.article.generate.useMutation({
    onSuccess: (data) => {
      showToast('記事を生成しました！', 'success');
      navigate(`/editor/${data.articleId}`);
    },
    onError: (err) => {
      showToast(err.message, 'error');
    },
  });

  useEffect(() => {
    if (!videoUrl) navigate('/');
  }, [videoUrl, navigate]);

  // Handle paste — auto-clean timestamps
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const cleaned = cleanTranscriptText(pasted);
    setTranscriptText(cleaned);
  }, []);

  const handleGenerate = () => {
    const seoKeywords = keywordsText
      .split(/[,、]/)
      .map((k) => k.trim())
      .filter(Boolean);

    const transcript = transcriptText.trim().length > 50
      ? transcriptText.trim()
      : undefined;

    generateMutation.mutate({
      videoUrl,
      tone: toneParam as 'casual' | 'polite' | 'professional',
      articleLength,
      seoKeywords,
      transcript,
    });
  };

  const handleGenerateWithoutTranscript = () => {
    const seoKeywords = keywordsText
      .split(/[,、]/)
      .map((k) => k.trim())
      .filter(Boolean);

    generateMutation.mutate({
      videoUrl,
      tone: toneParam as 'casual' | 'polite' | 'professional',
      articleLength,
      seoKeywords,
    });
  };

  const isProcessing = generateMutation.isPending;

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

      {/* Transcript Paste Area — main feature */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="mb-1">
          <h3 className="font-semibold text-gray-900">字幕テキストを貼り付け</h3>
          <p className="text-xs text-[#6B7280] mt-0.5">字幕を入れると記事の精度が大幅に向上します</p>
        </div>

        {/* How-to accordion */}
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1D4ED8] mt-2 mb-2"
        >
          <svg className={`w-3 h-3 transition-transform ${showGuide ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          貼り付け方法を見る
        </button>
        {showGuide && (
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 mb-3 text-xs text-[#374151] space-y-1.5">
            <ol className="list-decimal list-inside space-y-1">
              <li>YouTube動画ページを開く</li>
              <li>動画の下の「<strong>...</strong>」→「<strong>文字起こしを表示</strong>」をクリック</li>
              <li>表示されたテキストを全選択（Ctrl+A）してコピー</li>
              <li>この欄に貼り付け</li>
            </ol>
            <p className="text-[#9CA3AF]">※ タイムスタンプは自動で除去されます</p>
          </div>
        )}

        <textarea
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          onPaste={handlePaste}
          placeholder="YouTubeの文字起こしテキストをここに貼り付け..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-vertical outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          style={{ minHeight: '120px' }}
        />
        {transcriptText.trim().length > 0 && (
          <p className="text-xs text-[#6B7280] mt-1">{transcriptText.trim().length.toLocaleString()}文字</p>
        )}
      </div>

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

      {/* Generate without transcript — ghost button */}
      {transcriptText.trim().length === 0 && !isProcessing && (
        <div className="text-center">
          <button
            onClick={handleGenerateWithoutTranscript}
            disabled={isProcessing}
            className="text-xs text-[#9CA3AF] hover:text-[#6B7280] transition-colors disabled:opacity-50"
          >
            字幕なしで生成する
          </button>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">動画のメタデータのみで記事を生成します</p>
        </div>
      )}
    </div>
  );
}
