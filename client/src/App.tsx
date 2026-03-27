import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ApiSettings from './pages/ApiSettings';
import GenerationSettings from './pages/GenerationSettings';
import ArticleEditor from './pages/ArticleEditor';

const navItems = [
  { path: '/', label: 'ダッシュボード' },
  { path: '/settings', label: 'API設定' },
];

function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-gray-900 hover:text-gray-700">
            YouTube to Blog Master
          </Link>
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
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<ApiSettings />} />
          <Route path="/generate" element={<GenerationSettings />} />
          <Route path="/editor/:id" element={<ArticleEditor />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
