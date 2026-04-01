'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  Plus,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

// -- Types --

interface Competitor {
  id: string;
  name: string;
  domain: string;
  creativeCount: number;
  creativeCountTrend: number;
  estimatedSpend: number;
  estimatedSpendTrend: number;
  topCreatives: { headline: string; platform: string }[];
  lastUpdated: string;
}

interface BenchmarkMetric {
  metric: string;
  ours: number;
  industry: number;
  unit: string;
}

// -- Constants --

const MOCK_COMPETITORS: Competitor[] = [
  {
    id: '1', name: 'CompetitorA', domain: 'competitor-a.co.jp',
    creativeCount: 145, creativeCountTrend: 12,
    estimatedSpend: 2500000, estimatedSpendTrend: 8,
    topCreatives: [
      { headline: '今だけ50%OFF', platform: 'Google' },
      { headline: '新生活キャンペーン', platform: 'Meta' },
      { headline: '限定コレクション', platform: 'TikTok' },
    ],
    lastUpdated: '2026-04-01T12:00:00Z',
  },
  {
    id: '2', name: 'CompetitorB', domain: 'competitor-b.jp',
    creativeCount: 98, creativeCountTrend: -5,
    estimatedSpend: 1800000, estimatedSpendTrend: -3,
    topCreatives: [
      { headline: '会員限定セール', platform: 'LINE' },
      { headline: 'ポイント10倍', platform: 'Yahoo!' },
    ],
    lastUpdated: '2026-04-01T10:00:00Z',
  },
  {
    id: '3', name: 'CompetitorC', domain: 'competitor-c.com',
    creativeCount: 210, creativeCountTrend: 25,
    estimatedSpend: 3200000, estimatedSpendTrend: 15,
    topCreatives: [
      { headline: '期間限定タイムセール', platform: 'Google' },
      { headline: 'SNS限定クーポン', platform: 'Meta' },
      { headline: '新商品発売記念', platform: 'TikTok' },
    ],
    lastUpdated: '2026-04-02T06:00:00Z',
  },
];

const MOCK_BENCHMARKS: BenchmarkMetric[] = [
  { metric: 'CTR', ours: 3.8, industry: 2.5, unit: '%' },
  { metric: 'CPC', ours: 45, industry: 62, unit: '円' },
  { metric: 'CVR', ours: 2.1, industry: 1.8, unit: '%' },
  { metric: 'ROAS', ours: 3.2, industry: 2.4, unit: 'x' },
  { metric: 'CPA', ours: 2100, industry: 3400, unit: '円' },
];

const MOCK_SPEND_COMPARISON = [
  { name: '自社', google: 180, meta: 150, tiktok: 80, line: 60 },
  { name: 'CompetitorA', google: 120, meta: 100, tiktok: 60, line: 40 },
  { name: 'CompetitorB', google: 80, meta: 70, tiktok: 20, line: 50 },
  { name: 'CompetitorC', google: 150, meta: 130, tiktok: 90, line: 30 },
];

// -- Subcomponents --

function TrendIndicator({ value }: { value: number }): React.ReactElement {
  const isPositive = value >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-600')}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isPositive ? '+' : ''}{value}%
    </span>
  );
}

function CompetitorCard({
  competitor,
  onView,
}: {
  competitor: Competitor;
  onView: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{competitor.name}</h3>
          <a
            href={`https://${competitor.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <Globe size={10} />
            {competitor.domain}
            <ExternalLink size={10} />
          </a>
        </div>
        <button
          type="button"
          onClick={() => onView(competitor.id)}
          className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Eye size={12} className="mr-1 inline" />
          詳細
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">クリエイティブ数</p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-foreground">{competitor.creativeCount}</span>
            <TrendIndicator value={competitor.creativeCountTrend} />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">推定月間予算</p>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-foreground">
              {(competitor.estimatedSpend / 10000).toFixed(0)}万
            </span>
            <TrendIndicator value={competitor.estimatedSpendTrend} />
          </div>
        </div>
      </div>

      {/* Top creatives preview */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">トップクリエイティブ</p>
        <div className="space-y-1">
          {competitor.topCreatives.map((creative, i) => (
            <div key={i} className="flex items-center justify-between rounded bg-muted/50 px-3 py-1.5">
              <span className="text-xs text-foreground">{creative.headline}</span>
              <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {creative.platform}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground/60">
        最終更新: {new Intl.DateTimeFormat('ja-JP').format(new Date(competitor.lastUpdated))}
      </p>
    </div>
  );
}

interface AddCompetitorModalProps {
  open: boolean;
  onClose: () => void;
}

function AddCompetitorModal({ open, onClose }: AddCompetitorModalProps): React.ReactElement | null {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  function handleAdd(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!name || !domain) return;
    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
      onClose();
    }, 1500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">競合を追加</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label htmlFor="competitor-name" className="mb-1 block text-sm font-medium text-foreground">競合名</label>
            <input
              id="competitor-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="CompetitorD"
              required
            />
          </div>
          <div>
            <label htmlFor="competitor-domain" className="mb-1 block text-sm font-medium text-foreground">ドメイン</label>
            <input
              id="competitor-domain"
              type="text"
              value={domain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDomain(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="competitor-d.co.jp"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isAdding || !name || !domain}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Main Page --

export default function CompetitorsPage(): React.ReactElement {
  const [addOpen, setAddOpen] = useState(false);

  const competitors = MOCK_COMPETITORS;
  const benchmarks = MOCK_BENCHMARKS;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">競合分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">競合他社の広告戦略とパフォーマンスの分析</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <Plus size={16} />
          競合を追加
        </button>
      </div>

      {/* Competitor cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {competitors.map((competitor) => (
          <CompetitorCard
            key={competitor.id}
            competitor={competitor}
            onView={() => {/* detail view */}}
          />
        ))}
      </div>

      {/* Industry benchmark comparison */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">業界ベンチマーク比較</h2>
        <p className="mt-1 text-sm text-muted-foreground">自社 vs 業界平均</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">指標</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">自社</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">業界平均</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">差分</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">評価</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b) => {
                const diff = b.ours - b.industry;
                // For CPC and CPA lower is better
                const lowerIsBetter = b.metric === 'CPC' || b.metric === 'CPA';
                const isGood = lowerIsBetter ? diff <= 0 : diff >= 0;
                return (
                  <tr key={b.metric} className="border-b border-border">
                    <td className="px-4 py-2 font-medium text-foreground">{b.metric}</td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">
                      {b.ours.toLocaleString()}{b.unit}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {b.industry.toLocaleString()}{b.unit}
                    </td>
                    <td className={cn('px-4 py-2 text-right font-medium', isGood ? 'text-green-600' : 'text-red-600')}>
                      {diff > 0 ? '+' : ''}{diff.toLocaleString()}{b.unit}
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        isGood
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      )}>
                        {isGood ? '好調' : '改善余地あり'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spend comparison chart */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">推定広告費比較 (万円)</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={MOCK_SPEND_COMPARISON} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
              formatter={(value: number) => `${value}万円`}
            />
            <Legend />
            <Bar dataKey="google" name="Google" fill="#4285F4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="meta" name="Meta" fill="#6366F1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="tiktok" name="TikTok" fill="#EC4899" radius={[4, 4, 0, 0]} />
            <Bar dataKey="line" name="LINE" fill="#06C755" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Add competitor modal */}
      <AddCompetitorModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
