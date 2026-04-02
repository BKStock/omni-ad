'use client';

import { useState } from 'react';
import {
  Award,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Minus,
  Pause,
  Play,
  Plus,
  Settings2,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type TestStatus = 'running' | 'completed' | 'paused' | 'draft';
type MetricType = 'ctr' | 'cvr' | 'roas';
type TestTarget = 'creative' | 'headline' | 'cta' | 'targeting' | 'bidding';

interface Variant {
  name: string;
  description: string;
  impressions: number;
  metric: number;
  isWinner: boolean;
}

interface ABTest {
  id: string;
  name: string;
  status: TestStatus;
  metric: MetricType;
  target: TestTarget;
  campaignName: string;
  daysElapsed: number;
  daysPlanned: number;
  significance: number;
  requiredImpressions: number;
  currentImpressions: number;
  variants: Variant[];
  lift: number;
  pValue: number | null;
  confidenceInterval: { lower: number; upper: number } | null;
}

interface CreateFormVariant {
  name: string;
  description: string;
}

// ============================================================
// Constants
// ============================================================

const STATUS_CONFIG: Record<TestStatus, { label: string; className: string }> = {
  running: {
    label: '実行中',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  completed: {
    label: '完了',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  paused: {
    label: '一時停止',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  draft: {
    label: '下書き',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
};

const METRIC_CONFIG: Record<MetricType, { label: string; className: string; format: (v: number) => string }> = {
  ctr: {
    label: 'CTR',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    format: (v) => `${(v * 100).toFixed(2)}%`,
  },
  cvr: {
    label: 'CVR',
    className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    format: (v) => `${(v * 100).toFixed(2)}%`,
  },
  roas: {
    label: 'ROAS',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    format: (v) => `${v.toFixed(2)}x`,
  },
};

const TARGET_OPTIONS: { value: TestTarget; label: string }[] = [
  { value: 'creative', label: 'クリエイティブ' },
  { value: 'headline', label: '見出し' },
  { value: 'cta', label: 'CTA' },
  { value: 'targeting', label: 'ターゲティング' },
  { value: 'bidding', label: '入札戦略' },
];

const CAMPAIGN_OPTIONS = [
  '春のプロモーション2026',
  'TikTok新規獲得キャンペーン',
  'ブランド認知拡大',
  'LINE公式キャンペーン',
  'GW特別セール',
];

// ============================================================
// Mock Data
// ============================================================

const MOCK_TESTS: ABTest[] = [
  {
    id: 't1',
    name: 'CTA文言テスト',
    status: 'running',
    metric: 'ctr',
    target: 'cta',
    campaignName: '春のプロモーション2026',
    daysElapsed: 7,
    daysPlanned: 14,
    significance: 67,
    requiredImpressions: 12000,
    currentImpressions: 8400,
    variants: [
      { name: '今すぐ購入', description: 'コントロール', impressions: 4200, metric: 0.032, isWinner: false },
      { name: '無料で試す', description: 'テスト', impressions: 4200, metric: 0.0359, isWinner: true },
    ],
    lift: 12.3,
    pValue: null,
    confidenceInterval: null,
  },
  {
    id: 't2',
    name: 'ヘッドライン検証',
    status: 'running',
    metric: 'cvr',
    target: 'headline',
    campaignName: 'TikTok新規獲得キャンペーン',
    daysElapsed: 12,
    daysPlanned: 14,
    significance: 89,
    requiredImpressions: 10000,
    currentImpressions: 9200,
    variants: [
      { name: '限定セール開催中', description: 'コントロール', impressions: 4600, metric: 0.018, isWinner: false },
      { name: '今だけ50%OFF', description: 'テスト', impressions: 4600, metric: 0.0225, isWinner: true },
    ],
    lift: 25.0,
    pValue: null,
    confidenceInterval: null,
  },
  {
    id: 't3',
    name: '画像スタイルA/B',
    status: 'completed',
    metric: 'ctr',
    target: 'creative',
    campaignName: 'ブランド認知拡大',
    daysElapsed: 14,
    daysPlanned: 14,
    significance: 97,
    requiredImpressions: 15000,
    currentImpressions: 15000,
    variants: [
      { name: 'フラットデザイン', description: 'コントロール', impressions: 7500, metric: 0.028, isWinner: false },
      { name: '3Dイラスト', description: 'テスト', impressions: 7500, metric: 0.0332, isWinner: true },
    ],
    lift: 18.5,
    pValue: 0.003,
    confidenceInterval: { lower: 0.0025, upper: 0.0077 },
  },
  {
    id: 't4',
    name: '入札戦略テスト',
    status: 'paused',
    metric: 'roas',
    target: 'bidding',
    campaignName: 'LINE公式キャンペーン',
    daysElapsed: 5,
    daysPlanned: 21,
    significance: 34,
    requiredImpressions: 20000,
    currentImpressions: 5600,
    variants: [
      { name: '手動CPC', description: 'コントロール', impressions: 2800, metric: 2.4, isWinner: true },
      { name: 'AI自動入札', description: 'テスト', impressions: 2800, metric: 2.2, isWinner: false },
    ],
    lift: -8.3,
    pValue: null,
    confidenceInterval: null,
  },
];

// ============================================================
// Subcomponents
// ============================================================

function StatusBadge({ status }: { status: TestStatus }): React.ReactElement {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

function MetricBadge({ metric }: { metric: MetricType }): React.ReactElement {
  const config = METRIC_CONFIG[metric];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

function SignificanceBar({ significance, requiredImpressions, currentImpressions }: {
  significance: number;
  requiredImpressions: number;
  currentImpressions: number;
}): React.ReactElement {
  const remaining = Math.max(0, requiredImpressions - currentImpressions);
  const barColor = significance >= 95
    ? 'bg-green-500'
    : significance >= 80
      ? 'bg-yellow-500'
      : 'bg-muted-foreground/50';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">統計的有意性</span>
        <span className={cn(
          'font-semibold',
          significance >= 95 ? 'text-green-600' : significance >= 80 ? 'text-yellow-600' : 'text-muted-foreground',
        )}>
          {significance}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(100, significance)}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {significance >= 95
          ? '統計的に有意です'
          : `95%まで あと約 ${remaining.toLocaleString()} impressions`}
      </p>
    </div>
  );
}

function VariantComparisonChart({ variants, metric }: {
  variants: Variant[];
  metric: MetricType;
}): React.ReactElement {
  const chartData = variants.map((v) => ({
    name: v.name,
    value: metric === 'roas' ? v.metric : v.metric * 100,
  }));

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v: number) => metric === 'roas' ? `${v}x` : `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            formatter={(value: number) => metric === 'roas' ? `${value.toFixed(2)}x` : `${value.toFixed(2)}%`}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar
            dataKey="value"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
            barSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TestCardProps {
  test: ABTest;
  onDeclareWinner: (testId: string) => void;
  onPause: (testId: string) => void;
  onDelete: (testId: string) => void;
}

function TestCard({ test, onDeclareWinner, onPause, onDelete }: TestCardProps): React.ReactElement {
  const metricConfig = METRIC_CONFIG[test.metric];

  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/20">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="flex-shrink-0 text-purple-500" />
            <h3 className="truncate text-sm font-semibold text-foreground">{test.name}</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{test.campaignName}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <MetricBadge metric={test.metric} />
          <StatusBadge status={test.status} />
        </div>
      </div>

      {/* Duration */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{test.daysElapsed}日目 / {test.daysPlanned}日予定</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/60"
            style={{ width: `${Math.min(100, (test.daysElapsed / test.daysPlanned) * 100)}%` }}
          />
        </div>
      </div>

      {/* Significance bar */}
      <div className="mt-3">
        <SignificanceBar
          significance={test.significance}
          requiredImpressions={test.requiredImpressions}
          currentImpressions={test.currentImpressions}
        />
      </div>

      {/* Variant comparison */}
      <div className="mt-4 space-y-2">
        {test.variants.map((variant, idx) => (
          <div
            key={variant.name}
            className={cn(
              'rounded-md border p-3',
              variant.isWinner ? 'border-green-200 bg-green-50/50 dark:border-green-800/50 dark:bg-green-950/20' : 'border-border',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm font-medium text-foreground">{variant.name}</span>
                {variant.isWinner && (
                  <Trophy size={12} className="text-green-600 dark:text-green-400" />
                )}
              </div>
              <span className="text-sm font-semibold text-foreground">
                {metricConfig.format(variant.metric)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{variant.impressions.toLocaleString()} impressions</span>
              <span>{variant.description}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-3">
        <VariantComparisonChart variants={test.variants} metric={test.metric} />
      </div>

      {/* Lift indicator */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">リフト</span>
        <span className={cn(
          'text-sm font-bold',
          test.lift > 0 ? 'text-green-600' : test.lift < 0 ? 'text-red-600' : 'text-muted-foreground',
        )}>
          {test.lift > 0 ? '+' : ''}{test.lift.toFixed(1)}%
        </span>
      </div>

      {/* Completed test results */}
      {test.status === 'completed' && test.pValue !== null && test.confidenceInterval !== null && (
        <div className="mt-3 rounded-md bg-muted/50 p-3">
          <p className="text-xs font-semibold text-foreground">最終結果</p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-muted-foreground">p値: </span>
              <span className="font-medium text-foreground">{test.pValue.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">信頼区間: </span>
              <span className="font-medium text-foreground">
                [{(test.confidenceInterval.lower * 100).toFixed(2)}%, {(test.confidenceInterval.upper * 100).toFixed(2)}%]
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        {test.status === 'running' && test.significance >= 95 && (
          <button
            type="button"
            onClick={() => onDeclareWinner(test.id)}
            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
          >
            <Award size={12} />
            勝者宣言
          </button>
        )}
        {test.status === 'completed' && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ChevronRight size={12} />
            結果を適用
          </button>
        )}
        {test.status === 'running' && (
          <button
            type="button"
            onClick={() => onPause(test.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Pause size={12} />
            一時停止
          </button>
        )}
        {test.status === 'paused' && (
          <button
            type="button"
            onClick={() => onPause(test.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Play size={12} />
            再開
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(test.id)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <Trash2 size={12} />
          削除
        </button>
      </div>
    </div>
  );
}

// -- Create Test Modal --

interface CreateTestModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateTestModal({ open, onClose }: CreateTestModalProps): React.ReactElement | null {
  const [name, setName] = useState('');
  const [target, setTarget] = useState<TestTarget>('creative');
  const [metric, setMetric] = useState<MetricType>('ctr');
  const [campaign, setCampaign] = useState(CAMPAIGN_OPTIONS[0] ?? '');
  const [variants, setVariants] = useState<CreateFormVariant[]>([
    { name: '', description: '' },
    { name: '', description: '' },
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mde, setMde] = useState(10);
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.80);

  if (!open) return null;

  // Sample size calculation (simplified client-side estimate)
  const zAlpha = 1.96; // approx for alpha=0.05
  const zBeta = 0.84; // approx for power=0.80
  const baselineRate = metric === 'ctr' ? 0.05 : metric === 'cvr' ? 0.02 : 0;
  const mdeDecimal = mde / 100;

  let perVariant = 0;
  if (metric === 'roas') {
    perVariant = Math.ceil((2 * (zAlpha + zBeta) ** 2) / (mdeDecimal ** 2));
  } else {
    const p1 = baselineRate;
    const p2 = baselineRate * (1 + mdeDecimal);
    const diff = p1 - p2;
    if (diff !== 0) {
      perVariant = Math.ceil(
        ((zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (diff ** 2),
      );
    }
  }
  const totalSample = perVariant * variants.length;
  const estimatedDays = perVariant > 0 ? Math.ceil(totalSample / 1500) : 0;

  function addVariant(): void {
    setVariants((prev) => [...prev, { name: '', description: '' }]);
  }

  function removeVariant(index: number): void {
    if (variants.length <= 2) return;
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVariant(index: number, field: keyof CreateFormVariant, value: string): void {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // In production, call tRPC mutation
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">新規A/Bテスト作成</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Test name */}
          <div>
            <label htmlFor="test-name" className="mb-1 block text-sm font-medium text-foreground">
              テスト名
            </label>
            <input
              id="test-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="CTA文言テスト"
              required
            />
          </div>

          {/* Test target */}
          <div>
            <label htmlFor="test-target" className="mb-1 block text-sm font-medium text-foreground">
              テスト対象
            </label>
            <div className="relative">
              <select
                id="test-target"
                value={target}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTarget(e.target.value as TestTarget)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {TARGET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Metric */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">目標指標</span>
            <div className="flex gap-3">
              {(['ctr', 'cvr', 'roas'] as const).map((m) => (
                <label
                  key={m}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                    metric === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <input
                    type="radio"
                    name="metric"
                    value={m}
                    checked={metric === m}
                    onChange={() => setMetric(m)}
                    className="sr-only"
                  />
                  {METRIC_CONFIG[m].label}
                </label>
              ))}
            </div>
          </div>

          {/* Campaign selection */}
          <div>
            <label htmlFor="test-campaign" className="mb-1 block text-sm font-medium text-foreground">
              キャンペーン
            </label>
            <div className="relative">
              <select
                id="test-campaign"
                value={campaign}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCampaign(e.target.value)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CAMPAIGN_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Variants */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">バリアント設定</span>
            <div className="space-y-3">
              {variants.map((variant, idx) => (
                <div key={idx} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {idx === 0 ? 'コントロール (A)' : `テスト (${String.fromCharCode(65 + idx)})`}
                    </span>
                    {idx >= 2 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="rounded p-0.5 text-muted-foreground hover:text-red-600"
                        aria-label="バリアントを削除"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={variant.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariant(idx, 'name', e.target.value)}
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="バリアント名"
                    required
                  />
                  <input
                    type="text"
                    value={variant.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariant(idx, 'description', e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="説明"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
            >
              <Plus size={14} />
              バリアント追加
            </button>
          </div>

          {/* Advanced settings (collapsible) */}
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={14} className="text-muted-foreground" />
                詳細設定
              </div>
              <ChevronDown size={14} className={cn('transition-transform', showAdvanced && 'rotate-180')} />
            </button>
            {showAdvanced && (
              <div className="space-y-4 border-t border-border px-4 py-4">
                {/* MDE slider */}
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="mde-slider" className="text-sm font-medium text-foreground">
                      最小検出効果 (MDE)
                    </label>
                    <span className="text-sm font-semibold text-primary">{mde}%</span>
                  </div>
                  <input
                    id="mde-slider"
                    type="range"
                    min={5}
                    max={30}
                    step={1}
                    value={mde}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMde(Number(e.target.value))}
                    className="mt-2 w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>5%</span>
                    <span>30%</span>
                  </div>
                </div>

                {/* Alpha */}
                <div>
                  <label htmlFor="alpha-input" className="mb-1 block text-sm font-medium text-foreground">
                    有意水準 (alpha)
                  </label>
                  <input
                    id="alpha-input"
                    type="number"
                    step={0.01}
                    min={0.01}
                    max={0.1}
                    value={alpha}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAlpha(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Power */}
                <div>
                  <label htmlFor="power-input" className="mb-1 block text-sm font-medium text-foreground">
                    検出力 (1-beta)
                  </label>
                  <input
                    id="power-input"
                    type="number"
                    step={0.05}
                    min={0.5}
                    max={0.99}
                    value={power}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPower(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Auto-calculated sample size */}
          <div className="rounded-md bg-primary/5 p-4">
            <p className="text-xs font-semibold text-primary">必要サンプルサイズ</p>
            <p className="mt-1 text-sm text-foreground">
              各バリアント <span className="font-bold">{perVariant.toLocaleString()}</span> impressions 必要
              <span className="text-muted-foreground"> (合計 {totalSample.toLocaleString()})</span>
            </p>
            {estimatedDays > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                推定 <span className="font-semibold text-foreground">{estimatedDays}日</span> で結果判明
              </p>
            )}
          </div>

          {/* Form actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!name || variants.some((v) => !v.name)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              テストを作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function ABTestsPage(): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false);
  const [tests, setTests] = useState<ABTest[]>(MOCK_TESTS);

  const activeTests = tests.filter((t) => t.status === 'running' || t.status === 'paused' || t.status === 'draft');
  const completedTests = tests.filter((t) => t.status === 'completed');

  function handleDeclareWinner(testId: string): void {
    setTests((prev) =>
      prev.map((t) => (t.id === testId ? { ...t, status: 'completed' as const } : t)),
    );
  }

  function handlePause(testId: string): void {
    setTests((prev) =>
      prev.map((t) => {
        if (t.id !== testId) return t;
        return {
          ...t,
          status: (t.status === 'running' ? 'paused' : 'running') as TestStatus,
        };
      }),
    );
  }

  function handleDelete(testId: string): void {
    setTests((prev) => prev.filter((t) => t.id !== testId));
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            A/Bテスト管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            統計的に有意なテストを設計・管理し、最適なクリエイティブと設定を見つけます
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <Plus size={16} />
          新規テスト作成
        </button>
      </div>

      {/* Active tests */}
      {activeTests.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            アクティブテスト
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({activeTests.length}件)
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {activeTests.map((test) => (
              <TestCard
                key={test.id}
                test={test}
                onDeclareWinner={handleDeclareWinner}
                onPause={handlePause}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed tests */}
      {completedTests.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            完了済みテスト
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({completedTests.length}件)
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {completedTests.map((test) => (
              <TestCard
                key={test.id}
                test={test}
                onDeclareWinner={handleDeclareWinner}
                onPause={handlePause}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tests.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-16">
          <FlaskConical size={48} className="text-muted-foreground/30" />
          <p className="text-muted-foreground">A/Bテストがまだありません</p>
          <p className="text-sm text-muted-foreground/70">
            「新規テスト作成」ボタンから最初のテストを開始しましょう
          </p>
        </div>
      )}

      {/* Create test modal */}
      <CreateTestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
