import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/Toast';

type Tone = 'professional_assertive' | 'friendly_advisor';
type Strength = 'weak' | 'medium' | 'strong';

interface Settings {
  tone: Tone;
  decorationStrength: {
    history: Strength;
    qa: Strength;
    scenes: Strength;
  };
  articleLength: 'standard' | 'long';
  seoKeywords: string[];
}

const defaultSettings: Settings = {
  tone: 'professional_assertive',
  decorationStrength: { history: 'medium', qa: 'medium', scenes: 'medium' },
  articleLength: 'standard',
  seoKeywords: [],
};

const strengthLabels: Record<Strength, string> = {
  weak: '弱',
  medium: '中',
  strong: '強',
};

export default function GenerationSettings() {
  const [searchParams] = useSearchParams();
  const videoUrl = searchParams.get('url') || '';
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [keywordsText, setKeywordsText] = useState('');
  const [templateName, setTemplateName] = useState('');

  const templatesQuery = trpc.template.list.useQuery();
  const saveTemplateMutation = trpc.template.save.useMutation({
    onSuccess: () => {
      showToast('テンプレートを保存しました', 'success');
      setTemplateName('');
      templatesQuery.refetch();
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  const generateMutation = trpc.article.generate.useMutation({
    onSuccess: (data) => {
      showToast('記事を生成しました！', 'success');
      navigate(`/editor/${data.articleId}`);
    },
    onError: (err) => showToast(err.message, 'error'),
  });

  useEffect(() => {
    if (!videoUrl) navigate('/');
  }, [videoUrl, navigate]);

  const handleStrengthChange = (
    field: 'history' | 'qa' | 'scenes',
    value: Strength,
  ) => {
    setSettings((prev) => ({
      ...prev,
      decorationStrength: { ...prev.decorationStrength, [field]: value },
    }));
  };

  const handleGenerate = () => {
    const seoKeywords = keywordsText
      .split(/[,、]/)
      .map((k) => k.trim())
      .filter(Boolean);

    generateMutation.mutate({
      videoUrl,
      tone: settings.tone,
      decorationStrength: settings.decorationStrength,
      articleLength: settings.articleLength,
      seoKeywords,
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      showToast('テンプレート名を入力してください', 'error');
      return;
    }
    saveTemplateMutation.mutate({
      name: templateName,
      tone: settings.tone,
      decorationStrength: settings.decorationStrength,
      articleLength: settings.articleLength,
      seoKeywords: keywordsText
        .split(/[,、]/)
        .map((k) => k.trim())
        .filter(Boolean),
    });
  };

  const handleLoadTemplate = (template: {
    tone: string | null;
    decorationStrength?: unknown;
    articleLength: string | null;
    seoKeywords?: unknown;
  }) => {
    const ds = template.decorationStrength as Settings['decorationStrength'] | null;
    const kw = template.seoKeywords as string[] | null;
    setSettings({
      tone: (template.tone as Tone) || 'professional_assertive',
      decorationStrength: ds || defaultSettings.decorationStrength,
      articleLength: (template.articleLength as 'standard' | 'long') || 'standard',
      seoKeywords: kw || [],
    });
    if (kw) setKeywordsText(kw.join(', '));
    showToast('テンプレートを読み込みました', 'info');
  };

  const StrengthSelector = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Strength;
    onChange: (v: Strength) => void;
  }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex gap-1">
        {(['weak', 'medium', 'strong'] as Strength[]).map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              value === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {strengthLabels[s]}
          </button>
        ))}
      </div>
    </div>
  );

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

      {/* Tone */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">トーン選択</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={settings.tone === 'professional_assertive'}
              onChange={() => setSettings((p) => ({ ...p, tone: 'professional_assertive' }))}
              className="text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">断定的なプロ</div>
              <div className="text-sm text-gray-500">強い表現、確信を持った言い方</div>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={settings.tone === 'friendly_advisor'}
              onChange={() => setSettings((p) => ({ ...p, tone: 'friendly_advisor' }))}
              className="text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">親しみやすいアドバイザー</div>
              <div className="text-sm text-gray-500">柔らかい表現、読者への寄り添い</div>
            </div>
          </label>
        </div>
      </div>

      {/* Decoration Strength */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">盛り付け強度</h3>
        <StrengthSelector
          label="歴史的背景"
          value={settings.decorationStrength.history}
          onChange={(v) => handleStrengthChange('history', v)}
        />
        <StrengthSelector
          label="Q&A"
          value={settings.decorationStrength.qa}
          onChange={(v) => handleStrengthChange('qa', v)}
        />
        <StrengthSelector
          label="シーン別ガイド"
          value={settings.decorationStrength.scenes}
          onChange={(v) => handleStrengthChange('scenes', v)}
        />
      </div>

      {/* Article Length */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">記事長</h3>
        <div className="flex gap-3">
          <label className="flex-1 flex items-center gap-2 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={settings.articleLength === 'standard'}
              onChange={() => setSettings((p) => ({ ...p, articleLength: 'standard' }))}
              className="text-blue-600"
            />
            <span className="text-sm">標準（3,000文字）</span>
          </label>
          <label className="flex-1 flex items-center gap-2 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={settings.articleLength === 'long'}
              onChange={() => setSettings((p) => ({ ...p, articleLength: 'long' }))}
              className="text-blue-600"
            />
            <span className="text-sm">長編（5,000文字以上）</span>
          </label>
        </div>
      </div>

      {/* SEO Keywords */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">SEOキーワード</h3>
        <input
          type="text"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          placeholder="スーツ, 着こなし, マナー"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">カンマ区切りで複数入力</p>
      </div>

      {/* Templates */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">テンプレート</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="テンプレート名"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
          />
          <button
            onClick={handleSaveTemplate}
            disabled={saveTemplateMutation.isPending}
            className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            保存
          </button>
        </div>
        {templatesQuery.data?.templates && templatesQuery.data.templates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {templatesQuery.data.templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleLoadTemplate(t)}
                className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generateMutation.isPending}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {generateMutation.isPending ? (
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
