// Phase 9b — every chart offers "View as table" (accessibility requirement).
// Wraps an existing chart without changing its drawing; the table reads the
// same rows the chart already received.
import { useState, type ReactNode } from "react";
import { Table2, LineChart as LineIcon } from "lucide-react";

export interface ChartTableColumn<Row> { key: keyof Row & string; label: string }

export function ChartFrame<Row extends Record<string, unknown>>({
  title,
  rows,
  columns,
  children,
  testId,
}: {
  title: string;
  rows: Row[];
  columns: ChartTableColumn<Row>[];
  children: ReactNode;
  testId?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div data-testid={testId ?? "chart-frame"} data-chart-view={asTable ? "table" : "chart"}>
      <div className="flex justify-end">
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-path underline-offset-2 hover:underline"
          data-testid="chart-view-as-table"
        >
          {asTable ? <LineIcon className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
          {asTable ? "View as chart" : "View as table"}
        </button>
      </div>
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="chart-table">
            <caption className="sr-only">{title}</caption>
            <thead className="text-left text-ink-muted">
              <tr>{columns.map((c) => <th key={c.key} scope="col" className="py-1 pr-3">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => <td key={c.key} className="py-1 pr-3 tabular-nums">{r[c.key] == null ? "—" : String(r[c.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <figure aria-label={title} className="m-0">{children}</figure>
      )}
    </div>
  );
}
