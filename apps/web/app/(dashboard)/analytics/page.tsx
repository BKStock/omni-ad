import { BarChart3, Eye, MousePointerClick, ShoppingCart, TrendingUp } from 'lucide-react';

interface SummaryCard {
  label: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}

const SUMMARY_CARDS: SummaryCard[] = [
  {
    label: '総インプレッション',
    value: '---',
    icon: <Eye size={20} className="text-blue-500" />,
    description: '全チャネル合計',
  },
  {
    label: '総クリック',
    value: '---',
    icon: <MousePointerClick size={20} className="text-green-500" />,
    description: '全チャネル合計',
  },
  {
    label: '総コンバージョン',
    value: '---',
    icon: <ShoppingCart size={20} className="text-purple-500" />,
    description: '全チャネル合計',
  },
  {
    label: 'ROAS',
    value: '---',
    icon: <TrendingUp size={20} className="text-orange-500" />,
    description: '広告費用対効果',
  },
];

export default function AnalyticsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          クロスチャネル分析
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          全チャネルのパフォーマンスを統合的に分析
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {card.label}
              </p>
              {card.icon}
            </div>
            <p className="mt-3 text-3xl font-bold text-foreground">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            パフォーマンス推移
          </h2>
        </div>
        <div className="flex h-80 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <BarChart3 size={48} className="text-muted-foreground/30" />
            <p className="text-sm">データを取得するとチャートが表示されます</p>
          </div>
        </div>
      </div>
    </div>
  );
}
