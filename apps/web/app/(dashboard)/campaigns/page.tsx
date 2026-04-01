'use client';

import { useState } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  Edit3,
  FolderKanban,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

// -- Types --

type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
type Platform = 'google' | 'meta' | 'tiktok' | 'line' | 'x' | 'yahoo_japan';
type Objective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'conversion' | 'retargeting';
type SortField = 'name' | 'status' | 'budget' | 'roas' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  platforms: Platform[];
  budget: { total: number; currency: string; dailyLimit?: number };
  roas: number;
  updatedAt: string;
  objective: Objective;
}

// -- Constants --

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: '下書き', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  active: { label: '配信中', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  paused: { label: '一時停止', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completed: { label: '完了', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  archived: { label: 'アーカイブ', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const PLATFORM_CONFIG: Record<Platform, { label: string; color: string }> = {
  google: { label: 'Google', color: 'bg-blue-500' },
  meta: { label: 'Meta', color: 'bg-indigo-500' },
  tiktok: { label: 'TikTok', color: 'bg-pink-500' },
  line: { label: 'LINE', color: 'bg-green-500' },
  x: { label: 'X', color: 'bg-gray-700' },
  yahoo_japan: { label: 'Yahoo!', color: 'bg-red-500' },
};

const OBJECTIVE_OPTIONS: { value: Objective; label: string }[] = [
  { value: 'awareness', label: '認知拡大' },
  { value: 'traffic', label: 'トラフィック' },
  { value: 'engagement', label: 'エンゲージメント' },
  { value: 'leads', label: 'リード獲得' },
  { value: 'conversion', label: 'コンバージョン' },
  { value: 'retargeting', label: 'リターゲティング' },
];

const TABLE_COLUMNS: { key: SortField | 'platforms' | 'actions'; label: string; sortable: boolean }[] = [
  { key: 'name', label: '名前', sortable: true },
  { key: 'status', label: 'ステータス', sortable: true },
  { key: 'platforms', label: '配信先', sortable: false },
  { key: 'budget', label: '予算', sortable: true },
  { key: 'roas', label: 'ROAS', sortable: true },
  { key: 'updatedAt', label: '更新日', sortable: true },
  { key: 'actions', label: '操作', sortable: false },
];

// -- Subcomponents --

function StatusBadge({ status }: { status: CampaignStatus }): React.ReactElement {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}

function PlatformBadges({ platforms }: { platforms: Platform[] }): React.ReactElement {
  return (
    <div className="flex gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          className={cn('inline-flex h-6 items-center rounded px-1.5 text-[10px] font-medium text-white', PLATFORM_CONFIG[p].color)}
          title={PLATFORM_CONFIG[p].label}
        >
          {PLATFORM_CONFIG[p].label}
        </span>
      ))}
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}

function SortHeader({ label, field, currentField, direction, onSort }: SortHeaderProps): React.ReactElement {
  const isActive = currentField === field;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left font-medium text-muted-foreground hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown
        size={14}
        className={cn('transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground/40')}
        style={isActive && direction === 'desc' ? { transform: 'scaleY(-1)' } : undefined}
      />
    </button>
  );
}

function SkeletonRow(): React.ReactElement {
  return (
    <tr className="animate-pulse border-b border-border">
      {TABLE_COLUMNS.map((col) => (
        <td key={col.key} className="px-4 py-3">
          <div className="h-4 w-20 rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateCampaignModal({ open, onClose }: CreateCampaignModalProps): React.ReactElement | null {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<Objective>('conversion');
  const [budgetTotal, setBudgetTotal] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  function togglePlatform(platform: Platform): void {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!name || !budgetTotal || selectedPlatforms.length === 0 || !startDate) return;

    createMutation.mutate({
      name,
      objective,
      totalBudget: budgetTotal,
      dailyBudget: dailyLimit || budgetTotal,
      startDate,
      endDate: endDate || undefined,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">新規キャンペーン作成</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="campaign-name" className="mb-1 block text-sm font-medium text-foreground">
              キャンペーン名
            </label>
            <input
              id="campaign-name"
              type="text"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="春のプロモーションキャンペーン"
              required
            />
          </div>

          {/* Objective */}
          <div>
            <label htmlFor="campaign-objective" className="mb-1 block text-sm font-medium text-foreground">
              目的
            </label>
            <div className="relative">
              <select
                id="campaign-objective"
                value={objective}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setObjective(e.target.value as Objective)}
                className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {OBJECTIVE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="campaign-budget" className="mb-1 block text-sm font-medium text-foreground">
                総予算 (JPY)
              </label>
              <input
                id="campaign-budget"
                type="number"
                value={budgetTotal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudgetTotal(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="500000"
                min="1"
                required
              />
            </div>
            <div>
              <label htmlFor="campaign-daily-limit" className="mb-1 block text-sm font-medium text-foreground">
                日次上限 (任意)
              </label>
              <input
                id="campaign-daily-limit"
                type="number"
                value={dailyLimit}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDailyLimit(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="50000"
                min="1"
              />
            </div>
          </div>

          {/* Platforms */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground">配信プラットフォーム</span>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PLATFORM_CONFIG) as [Platform, { label: string; color: string }][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePlatform(key)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      selectedPlatforms.includes(key)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {config.label}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="campaign-start" className="mb-1 block text-sm font-medium text-foreground">
                開始日
              </label>
              <input
                id="campaign-start"
                type="date"
                value={startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label htmlFor="campaign-end" className="mb-1 block text-sm font-medium text-foreground">
                終了日 (任意)
              </label>
              <input
                id="campaign-end"
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Error */}
          {createMutation.error && (
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          )}

          {/* Actions */}
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
              disabled={createMutation.isPending || !name || !budgetTotal || selectedPlatforms.length === 0 || !startDate}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -- Mock data for demo (until API is implemented) --

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    name: '春のプロモーション2026',
    status: 'active',
    platforms: ['google', 'meta', 'line'],
    budget: { total: 500000, currency: 'JPY', dailyLimit: 50000 },
    roas: 3.2,
    updatedAt: '2026-04-01T10:00:00Z',
    objective: 'conversion',
  },
  {
    id: '2',
    name: 'TikTok新規獲得キャンペーン',
    status: 'paused',
    platforms: ['tiktok'],
    budget: { total: 200000, currency: 'JPY' },
    roas: 1.8,
    updatedAt: '2026-03-28T14:30:00Z',
    objective: 'leads',
  },
  {
    id: '3',
    name: 'ブランド認知拡大',
    status: 'draft',
    platforms: ['google', 'meta', 'x', 'yahoo_japan'],
    budget: { total: 1000000, currency: 'JPY', dailyLimit: 100000 },
    roas: 0,
    updatedAt: '2026-03-25T09:00:00Z',
    objective: 'awareness',
  },
  {
    id: '4',
    name: '年末セール 2025',
    status: 'completed',
    platforms: ['google', 'meta', 'line', 'yahoo_japan'],
    budget: { total: 800000, currency: 'JPY' },
    roas: 4.5,
    updatedAt: '2026-01-15T18:00:00Z',
    objective: 'retargeting',
  },
];

// -- Main Page --

export default function CampaignsPage(): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // tRPC query with fallback to mock data
  const campaignsQuery = trpc.campaigns.list.useQuery(undefined, {
    retry: false,
  });

  const pauseMutation = trpc.campaigns.pause.useMutation();
  const resumeMutation = trpc.campaigns.resume.useMutation();

  // Use mock data when API is not available
  const campaigns: Campaign[] = campaignsQuery.error
    ? MOCK_CAMPAIGNS
    : (campaignsQuery.data as Campaign[] | undefined) ?? MOCK_CAMPAIGNS;

  const isLoading = campaignsQuery.isLoading && !campaignsQuery.error;

  function handleSort(field: SortField): void {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'name':
        return a.name.localeCompare(b.name) * modifier;
      case 'status':
        return a.status.localeCompare(b.status) * modifier;
      case 'budget':
        return (a.budget.total - b.budget.total) * modifier;
      case 'roas':
        return (a.roas - b.roas) * modifier;
      case 'updatedAt':
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * modifier;
      default:
        return 0;
    }
  });

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
  }

  function formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateStr));
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            キャンペーン管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            全チャネルのキャンペーンを一元管理
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <Plus size={16} />
          新規キャンペーン作成
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {TABLE_COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {column.sortable ? (
                      <SortHeader
                        label={column.label}
                        field={column.key as SortField}
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : sortedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FolderKanban size={48} className="text-muted-foreground/30" />
                      <p className="text-muted-foreground">キャンペーンがまだありません</p>
                      <p className="text-sm text-muted-foreground/70">
                        「新規キャンペーン作成」ボタンから最初のキャンペーンを作成しましょう
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{campaign.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PlatformBadges platforms={campaign.platforms} />
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(campaign.budget.total)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('font-medium', campaign.roas >= 3 ? 'text-green-600' : campaign.roas >= 1 ? 'text-yellow-600' : 'text-muted-foreground')}>
                        {campaign.roas > 0 ? `${campaign.roas.toFixed(1)}x` : '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(campaign.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {campaign.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => pauseMutation.mutate({ id: campaign.id })}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-yellow-100 hover:text-yellow-700"
                            title="一時停止"
                            aria-label={`${campaign.name}を一時停止`}
                          >
                            <Pause size={14} />
                          </button>
                        ) : campaign.status === 'paused' ? (
                          <button
                            type="button"
                            onClick={() => resumeMutation.mutate({ id: campaign.id })}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-green-100 hover:text-green-700"
                            title="再開"
                            aria-label={`${campaign.name}を再開`}
                          >
                            <Play size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          title="編集"
                          aria-label={`${campaign.name}を編集`}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-700"
                          title="削除"
                          aria-label={`${campaign.name}を削除`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create campaign modal */}
      <CreateCampaignModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
