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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-[#111827] hover:text-[#374151]">
            <img src="/logo.svg" alt="TubeBlogGenerator" className="h-6 sm:h-7 w-auto" />
            <span className="hidden sm:inline">TubeBlogGenerator</span>
            <span className="sm:hidden">TBG</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'text-[#2563EB]'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 text-sm text-[#6B7280]">
              <span>{userName}</span>
              <button onClick={handleLogout} className="text-xs text-[#6B7280] hover:text-[#111827]">
                ログアウト
              </button>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-[#6B7280] hover:text-[#111827]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="メニュー"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E5E7EB] bg-white">
            <nav className="flex flex-col px-4 py-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`py-3 text-sm font-medium border-b border-[#E5E7EB] ${
                    location.pathname === item.path ? 'text-[#2563EB]' : 'text-[#6B7280]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="py-3 flex items-center justify-between text-sm text-[#6B7280]">
                <span>{userName}</span>
                <button onClick={handleLogout} className="text-xs text-[#EF4444] hover:text-red-700">ログアウト</button>
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8 flex-1 w-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<ApiSettings />} />
          <Route path="/generate" element={<GenerationSettings />} />
          <Route path="/editor/:id" element={<ArticleEditor />} />
        </Routes>
      </main>
      <footer className="border-t border-[#E5E7EB] bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-[#6B7280]">
          &copy; 2026 TubeBlogGenerator &nbsp;|&nbsp; Created by Dr.SK &nbsp;|&nbsp; v{packageJson.version}
        </div>
      </footer>
    </div>
  );
}

export default App;
