import { Link, useLocation } from 'react-router-dom';
import { Clock, Film, MapPin, User, Zap } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { path: '/timeline', label: 'タイムライン', icon: Clock },
    { path: '/movies', label: '作品から探す', icon: Film },
    { path: '/', label: 'すぐ観る！', icon: Zap, isMain: true },
    { path: '/theaters', label: '劇場マップ', icon: MapPin },
    { path: '/profile', label: 'マイページ', icon: User },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-slate-900">すぐ観る！</h1>
          <p className="text-sm text-slate-600">最速・最短で映画館へ滑り込む</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-around items-end">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isMain = 'isMain' in item && item.isMain;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center transition-colors ${
                    isMain ? 'py-2 px-3' : 'py-3 px-2'
                  } ${
                    isActive
                      ? 'text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className={`mb-1 ${
                    isMain
                      ? 'w-8 h-8'
                      : 'w-5 h-5'
                  } ${item.path === '/' && isActive ? 'text-red-500' : ''}`} />
                  <span className={`font-medium ${
                    isMain ? 'text-sm' : 'text-xs'
                  }`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
