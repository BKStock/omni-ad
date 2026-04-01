import { FolderKanban, Plus } from 'lucide-react';

const TABLE_COLUMNS = ['名前', 'ステータス', '配信先', '予算', 'ROAS', '更新日'] as const;

export default function CampaignsPage(): React.ReactElement {
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
                  <th
                    key={column}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={TABLE_COLUMNS.length}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    <FolderKanban
                      size={48}
                      className="text-muted-foreground/30"
                    />
                    <p className="text-muted-foreground">
                      キャンペーンがまだありません
                    </p>
                    <p className="text-sm text-muted-foreground/70">
                      「新規キャンペーン作成」ボタンから最初のキャンペーンを作成しましょう
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
