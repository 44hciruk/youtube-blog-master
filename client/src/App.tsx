import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ApiSettings from './pages/ApiSettings';
import GenerationSettings from './pages/GenerationSettings';
import ArticleEditor from './pages/ArticleEditor';
import Login from './pages/Login';
import packageJson from '../../package.json';

const navItems = [
  { path: '/', label: 'ダッシュボード' },
  { path: '/settings', label: 'API設定' },
];

function App() {
  const location = useLocation();
  const [userId, setUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem('userId');
    return stored ? Number(stored) : null;
  });
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('userName') || '';
  });

  const handleLogin = (id: number, name: string) => {
    setUserId(id);
    setUserName(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    setUserId(null);
    setUserName('');
  };

  if (!userId) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-gray-900 hover:text-gray-700">
            <img src="/logo.svg" alt="TubeBlogGenerator" className="h-7 w-auto" />
            TubeBlogGenerator
          </Link>
          <div className="flex items-center gap-6">
            <nav className="flex gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{userName}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<ApiSettings />} />
          <Route path="/generate" element={<GenerationSettings />} />
          <Route path="/editor/:id" element={<ArticleEditor />} />
        </Routes>
      </main>
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          &copy; 2026 TubeBlogGenerator &nbsp;|&nbsp; Created by Dr.SK &nbsp;|&nbsp; v{packageJson.version}
        </div>
      </footer>
    </div>
  );
}

export default App;
