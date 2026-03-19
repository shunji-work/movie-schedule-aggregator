import { Link, useLocation } from 'react-router-dom';
import { Clock3, Film, MapPin, User, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { path: '/timeline', label: 'タイムライン', icon: Clock3 },
  { path: '/movies', label: '作品一覧', icon: Film },
  { path: '/', label: 'すぐ観る', icon: Zap, isMain: true },
  { path: '/theaters', label: '映画館', icon: MapPin },
  { path: '/profile', label: 'プロフィール', icon: User },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">
              Movie Schedule Aggregator
            </p>
            <h1 className="text-2xl font-bold text-slate-900">近くの上映を横断検索</h1>
            <p className="text-sm text-slate-600">
              現在地から近い映画館の上映時間をまとめて比較できます。
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-50 text-slate-700"
          >
            ライブデータ優先
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                  active ? 'text-slate-950' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon
                  className={`${
                    item.isMain ? 'h-7 w-7' : 'h-5 w-5'
                  } ${active && item.isMain ? 'text-red-500' : ''}`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
