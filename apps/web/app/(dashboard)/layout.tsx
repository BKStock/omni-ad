'use client';

import { useState } from 'react';
import {
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  Gauge,
  GitFork,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings,
  Swords,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'キャンペーン', href: '/campaigns', icon: <LayoutDashboard size={20} /> },
  { label: 'クリエイティブ', href: '/creatives', icon: <BrainCircuit size={20} /> },
  { label: '分析', href: '/analytics', icon: <BarChart3 size={20} /> },
  { label: 'オーディエンス', href: '/audiences', icon: <Users size={20} /> },
  { label: '予算最適化', href: '/budgets', icon: <Gauge size={20} /> },
  { label: 'ファネル', href: '/funnels', icon: <GitFork size={20} /> },
  { label: 'レポート', href: '/reports', icon: <ScrollText size={20} /> },
  { label: '競合分析', href: '/competitors', icon: <Swords size={20} /> },
  { label: '設定', href: '/settings', icon: <Settings size={20} /> },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
          }}
          role="button"
          tabIndex={0}
          aria-label="メニューを閉じる"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 lg:relative lg:z-auto',
          sidebarOpen ? 'w-60' : 'w-16',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-accent px-4">
          {sidebarOpen && (
            <span className="text-lg font-bold tracking-tight">OMNI-AD</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:block"
            aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
          >
            <ChevronLeft
              size={18}
              className={cn(
                'transition-transform',
                !sidebarOpen && 'rotate-180',
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="メインナビゲーション">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                !sidebarOpen && 'justify-center px-2',
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </a>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-sidebar-accent p-3">
          {sidebarOpen && (
            <div className="rounded-md bg-sidebar-accent/50 px-3 py-2">
              <p className="text-xs text-sidebar-foreground/60">プラン</p>
              <p className="text-sm font-medium text-sidebar-foreground">
                プロフェッショナル
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label="メニューを開く"
          >
            <Menu size={20} />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                U
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-foreground">
                  ユーザー名
                </p>
                <p className="text-xs text-muted-foreground">管理者</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
