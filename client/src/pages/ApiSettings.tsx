import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/Toast';
import { Tooltip } from '../components/Tooltip';
import {
  OpenAIGuideModal,
  YouTubeGuideModal,
  GoogleGuideModal,
} from '../components/ApiKeyGuideModal';

type GuideType = 'openai' | 'youtube' | 'google' | null;

export default function ApiSettings() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [youtubeKey, setYoutubeKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [activeGuide, setActiveGuide] = useState<GuideType>(null);
  const { showToast, ToastContainer } = useToast();

  const apiKeysQuery = trpc.user.getApiKeys.useQuery();
  const saveMutation = trpc.user.saveApiKeys.useMutation({
    onSuccess: () => {
      showToast('APIキーを保存しました', 'success');
      setOpenaiKey('');
      setYoutubeKey('');
      setGoogleKey('');
      apiKeysQuery.refetch();
    },
    onError: (err) => showToast(err.message, 'error'),
  });
  const testMutation = trpc.user.testApiKey.useMutation({
    onSuccess: (data) => showToast(data.message, 'success'),
    onError: (err) => showToast(err.message, 'error'),
  });

  const handleSave = () => {
    const keys: { keyType: 'openai' | 'youtube' | 'google'; apiKey: string }[] = [];
    if (openaiKey.trim()) keys.push({ keyType: 'openai', apiKey: openaiKey.trim() });
    if (youtubeKey.trim()) keys.push({ keyType: 'youtube', apiKey: youtubeKey.trim() });
    if (googleKey.trim()) keys.push({ keyType: 'google', apiKey: googleKey.trim() });

    if (keys.length === 0) {
      showToast('APIキーを入力してください', 'error');
      return;
    }
    saveMutation.mutate({ keys });
  };

  const existingKeys = apiKeysQuery.data?.keys || [];
  const openaiKeyStatus = existingKeys.find((k) => k.keyType === 'openai');
  const youtubeKeyStatus = existingKeys.find((k) => k.keyType === 'youtube');
  const googleKeyStatus = existingKeys.find((k) => k.keyType === 'google');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ToastContainer />

      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">API設定</h2>

      {/* OpenAI */}
      <KeyCard
        title="OpenAI API Key"
        description="GPT-4oによる記事生成に使用します。"
        tooltip="ChatGPTのAPIキーです。platform.openai.com で取得できます。記事生成1本あたり約$0.02〜0.05かかります。"
        placeholder="sk-..."
        value={openaiKey}
        onChange={setOpenaiKey}
        keyType="openai"
        status={openaiKeyStatus}
        onGuideClick={() => setActiveGuide('openai')}
        onTest={() => testMutation.mutate({ keyType: 'openai' })}
        testPending={testMutation.isPending}
      />

      {/* YouTube */}
      <KeyCard
        title="YouTube Data API Key"
        description="動画メタデータ・字幕の取得に使用します。"
        tooltip="YouTube Data APIキーです。Google Cloud Consoleで無料取得できます。動画のタイトル・説明文の取得に使用します。"
        placeholder="AIza..."
        value={youtubeKey}
        onChange={setYoutubeKey}
        keyType="youtube"
        status={youtubeKeyStatus}
        onGuideClick={() => setActiveGuide('youtube')}
        onTest={() => testMutation.mutate({ keyType: 'youtube' })}
        testPending={testMutation.isPending}
      />

      {/* Google */}
      <KeyCard
        title="Google API Key"
        description="Nano Banana（Gemini）の画像生成に使用します。"
        tooltip="Nano Banana（Gemini）の画像生成に使用します。Google AI Studioで取得できます。"
        placeholder="AIza..."
        value={googleKey}
        onChange={setGoogleKey}
        keyType="google"
        status={googleKeyStatus}
        onGuideClick={() => setActiveGuide('google')}
        onTest={() => testMutation.mutate({ keyType: 'google' })}
        testPending={testMutation.isPending}
      />

      <button
        onClick={handleSave}
        disabled={saveMutation.isPending || (!openaiKey.trim() && !youtubeKey.trim() && !googleKey.trim())}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saveMutation.isPending ? '保存中...' : '保存'}
      </button>

      {/* Guide Modals */}
      <OpenAIGuideModal isOpen={activeGuide === 'openai'} onClose={() => setActiveGuide(null)} />
      <YouTubeGuideModal isOpen={activeGuide === 'youtube'} onClose={() => setActiveGuide(null)} />
      <GoogleGuideModal isOpen={activeGuide === 'google'} onClose={() => setActiveGuide(null)} />
    </div>
  );
}

function KeyCard({
  title,
  description,
  tooltip,
  placeholder,
  value,
  onChange,
  keyType,
  status,
  onGuideClick,
  onTest,
  testPending,
}: {
  title: string;
  description: string;
  tooltip: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  keyType: 'openai' | 'youtube' | 'google';
  status?: { maskedKey: string };
  onGuideClick: () => void;
  onTest: () => void;
  testPending: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <Tooltip text={tooltip} />
        </div>
        {status && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono">{status.maskedKey}</span>
            <span className="w-2 h-2 bg-green-500 rounded-full" />
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-3">
        {description}
        <button
          onClick={onGuideClick}
          className="text-blue-600 hover:underline ml-1"
        >
          取得方法を見る
        </button>
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm min-w-0"
        />
        <button
          onClick={onTest}
          disabled={testPending}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex-shrink-0"
        >
          テスト
        </button>
      </div>
    </div>
  );
}
