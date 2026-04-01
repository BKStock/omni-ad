import { Swords } from 'lucide-react';

export default function CompetitorsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          競合分析
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          競合他社の広告戦略とパフォーマンスの分析
        </p>
      </div>
      <div className="flex h-96 items-center justify-center rounded-lg border border-dashed border-border bg-card">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Swords size={48} className="text-muted-foreground/30" />
          <p className="text-lg font-medium">Coming Soon</p>
          <p className="text-sm">競合分析機能は開発中です</p>
        </div>
      </div>
    </div>
  );
}
