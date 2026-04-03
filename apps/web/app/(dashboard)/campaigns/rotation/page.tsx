'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// -- Types --

interface RotationOption {
  days: number;
  label: string;
}

interface Campaign {
  id: string;
  name: string;
  platform: string;
  status: string;
  rotation_days: number;
  last_creative_rotated_at: string | null;
}

interface RotationOptionsResponse {
  options: RotationOption[];
  default: number;
}

interface CampaignListResponse {
  campaigns: Campaign[];
}

// -- API helpers --

async function fetchRotationOptions(): Promise<RotationOption[]> {
  const res = await fetch('/api/engine/budget/rotation-options');
  if (!res.ok) throw new Error('オプション取得失敗');
  const data = (await res.json()) as RotationOptionsResponse;
  return data.options;
}

async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await fetch('/api/engine/campaigns');
  if (!res.ok) throw new Error('キャンペーン取得失敗');
  const data = (await res.json()) as CampaignListResponse;
  return data.campaigns;
}

async function updateRotation(campaignId: string, rotationDays: number): Promise<void> {
  const res = await fetch(`/api/engine/campaigns/${campaignId}/rotation`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rotation_days: rotationDays }),
  });
  if (!res.ok) throw new Error('更新失敗');
}

// -- Subcomponents --

function PlatformBadge({ platform }: { platform: string }): React.ReactElement {
  const colors: Record<string, string> = {
    meta: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    tiktok: 'bg-black/10 text-foreground dark:bg-white/10',
    google: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    x: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    line: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium uppercase',
        colors[platform] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {platform}
    </span>
  );
}

function RotationSelect({
  options,
  value,
  disabled,
  onChange,
}: {
  options: RotationOption[];
  value: number;
  disabled: boolean;
  onChange: (days: number) => void;
}): React.ReactElement {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.days} value={o.days}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

// -- Main Page --

export default function RotationPage(): React.ReactElement {
  const [options, setOptions] = useState<RotationOption[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // savingMap: campaignId -> boolean
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  // localDays: campaignId -> selected days (未保存の変更を保持)
  const [localDays, setLocalDays] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      try {
        const [opts, camps] = await Promise.all([fetchRotationOptions(), fetchCampaigns()]);
        setOptions(opts);
        setCampaigns(camps);
        const initial: Record<string, number> = {};
        camps.forEach((c) => {
          initial[c.id] = c.rotation_days;
        });
        setLocalDays(initial);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '読み込み失敗');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleChange(campaignId: string, days: number): void {
    setLocalDays((prev) => ({ ...prev, [campaignId]: days }));
    setSavedMap((prev) => ({ ...prev, [campaignId]: false }));
  }

  async function handleSave(campaignId: string): Promise<void> {
    const days = localDays[campaignId];
    if (days === undefined) return;

    setSavingMap((prev) => ({ ...prev, [campaignId]: true }));
    try {
      await updateRotation(campaignId, days);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, rotation_days: days } : c)),
      );
      setSavedMap((prev) => ({ ...prev, [campaignId]: true }));
      setTimeout(() => {
        setSavedMap((prev) => ({ ...prev, [campaignId]: false }));
      }, 2000);
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSavingMap((prev) => ({ ...prev, [campaignId]: false }));
    }
  }

  function isDirty(campaign: Campaign): boolean {
    return localDays[campaign.id] !== campaign.rotation_days;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          クリエイティブローテーション
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          キャンペーンごとにクリエイティブを差し替える間隔を設定します
        </p>
      </div>

      {/* 選択肢の説明 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {options.map((o) => (
          <div
            key={o.days}
            className="rounded-lg border border-border bg-card p-3 text-center"
          >
            <p className="text-lg font-bold text-foreground">{o.days}</p>
            <p className="text-xs text-muted-foreground">日ごと</p>
          </div>
        ))}
      </div>

      {/* キャンペーン一覧 */}
      {campaigns.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card">
          <RefreshCw size={28} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">アクティブなキャンペーンがありません</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  キャンペーン
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  プラットフォーム
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  ステータス
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  最終ローテーション
                </th>
                <th className="w-44 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  間隔
                </th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {campaign.id.slice(0, 8)}…
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <PlatformBadge platform={campaign.platform} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground capitalize">
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {campaign.last_creative_rotated_at
                      ? new Date(campaign.last_creative_rotated_at).toLocaleDateString('ja-JP')
                      : '未実施'}
                  </td>
                  <td className="px-4 py-3">
                    <RotationSelect
                      options={options}
                      value={localDays[campaign.id] ?? campaign.rotation_days}
                      disabled={savingMap[campaign.id] ?? false}
                      onChange={(days) => handleChange(campaign.id, days)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {savedMap[campaign.id] ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <Check size={13} />
                        保存済み
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSave(campaign.id)}
                        disabled={
                          !isDirty(campaign) || (savingMap[campaign.id] ?? false)
                        }
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {savingMap[campaign.id] ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : null}
                        保存
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
