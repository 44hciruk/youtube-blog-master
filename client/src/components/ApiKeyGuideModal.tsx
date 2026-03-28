interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4">{children}</div>
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 rounded-b-xl">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 mb-4">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm text-gray-700">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function OpenAIGuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="OpenAI APIキーの取得方法">
      <StepList steps={[
        'platform.openai.com にアクセス',
        'アカウント作成またはログイン',
        '左メニュー「API keys」をクリック',
        '「+ Create new secret key」をクリック',
        '名前を入力して「Create secret key」',
        '表示されたキーをコピーして閉じる',
      ]} />
      <div className="space-y-2 text-sm mb-4">
        <p className="text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          &#x26A0;&#xFE0F; キーは作成時の1回しか表示されません
        </p>
        <p className="text-gray-600">
          &#x1F4B0; 料金目安：記事1本あたり約$0.02〜0.05
        </p>
        <p className="text-gray-500 text-xs">
          クレジットチャージ：platform.openai.com/settings/billing
        </p>
      </div>
      <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer"
        className="block w-full py-2.5 text-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
        platform.openai.com を開く
      </a>
    </Modal>
  );
}

export function YouTubeGuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="YouTube Data APIキーの取得方法">
      <StepList steps={[
        'console.cloud.google.com にアクセス',
        'Googleアカウントでログイン',
        '「新しいプロジェクト」を作成',
        '「APIとサービス」→「ライブラリ」',
        '「YouTube Data API v3」を検索して有効化',
        '「認証情報」→「認証情報を作成」→「APIキー」',
        '作成されたキーをコピー',
      ]} />
      <p className="text-sm text-gray-600 mb-4">
        &#x1F4B0; 料金：無料（1日10,000リクエストまで）
      </p>
      <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer"
        className="block w-full py-2.5 text-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
        Google Cloud Console を開く
      </a>
    </Modal>
  );
}

export function GoogleGuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Google APIキー（Nano Banana画像生成）の取得方法">
      <StepList steps={[
        'aistudio.google.com にアクセス',
        'Googleアカウントでログイン',
        '「Get API key」をクリック',
        '「Create API key」をクリック',
        '作成されたキーをコピー',
      ]} />
      <p className="text-sm text-gray-600 mb-4">
        &#x1F4B0; 料金：無料枠あり（画像生成は従量課金）
      </p>
      <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer"
        className="block w-full py-2.5 text-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
        Google AI Studio を開く
      </a>
    </Modal>
  );
}
