import { useState, useRef, useEffect } from 'react';
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

/** Get the first character of a name, uppercased if alphanumeric */
function getAvatarInitial(name: string): string {
  if (!name) return '?';
  const first = name.charAt(0);
  return /[a-zA-Z0-9]/.test(first) ? first.toUpperCase() : first;
}

function UserAvatar({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-[#2563EB] text-white text-[13px] font-semibold flex items-center justify-center hover:bg-[#1D4ED8] transition-colors"
        aria-label="ユーザーメニュー"
      >
        {getAvatarInitial(userName)}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-40 bg-white border border-[#E5E7EB] rounded-xl shadow-sm py-1">
          <div className="px-3 py-2 text-sm text-[#111827] border-b border-[#E5E7EB]">
            {userName}
          </div>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full text-left px-3 py-2 text-sm text-[#EF4444] hover:bg-[#F9FAFB] transition-colors"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}

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
            <UserAvatar userName={userName} onLogout={handleLogout} />
          </div>

          {/* Mobile: avatar + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <UserAvatar userName={userName} onLogout={handleLogout} />
            <button
              className="p-2 text-[#6B7280] hover:text-[#111827]"
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
