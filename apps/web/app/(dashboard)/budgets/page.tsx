import { Gauge, PieChart, Sparkles } from 'lucide-react';

export default function BudgetsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            予算最適化
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AIによるリアルタイム予算配分の最適化
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <Sparkles size={16} />
          最適化を実行
        </button>
      </div>

      {/* Current allocation */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            現在の予算配分
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            チャネル別の予算配分状況
          </p>
          <div className="mt-6 flex h-64 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <PieChart size={48} className="text-muted-foreground/30" />
              <p className="text-sm">予算データが設定されていません</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            AI推奨配分
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            パフォーマンスデータに基づく最適配分
          </p>
          <div className="mt-6 flex h-64 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Gauge size={48} className="text-muted-foreground/30" />
              <p className="text-sm">
                最適化を実行するとAI推奨が表示されます
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
