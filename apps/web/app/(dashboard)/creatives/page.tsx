import { BrainCircuit } from 'lucide-react';

export default function CreativesPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          AIクリエイティブスタジオ
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AIを活用した広告クリエイティブの自動生成と最適化
        </p>
      </div>
      <div className="flex h-96 items-center justify-center rounded-lg border border-dashed border-border bg-card">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <BrainCircuit size={48} className="text-muted-foreground/30" />
          <p className="text-lg font-medium">Coming Soon</p>
          <p className="text-sm">AIクリエイティブ生成機能は開発中です</p>
        </div>
      </div>
    </div>
  );
}
