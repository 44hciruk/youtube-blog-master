import { useState } from 'react';

interface LoginProps {
  onLogin: (userId: number, name: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('名前を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json() as { userId?: number; name?: string; error?: string };

      if (!res.ok) {
        setError(data.error || 'ログインに失敗しました');
        return;
      }

      if (data.userId && data.name) {
        localStorage.setItem('userId', String(data.userId));
        localStorage.setItem('userName', data.name);
        onLogin(data.userId, data.name);
      }
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">YouTube to Blog Master</h1>
        <p className="text-sm text-gray-500 mb-8">名前を入力してログインしてください</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              お名前
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：田中"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'ログイン中...' : 'ログイン / 新規登録'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6 text-center">
          ※ 仲間内での利用を想定しています
        </p>
      </div>
    </div>
  );
}
