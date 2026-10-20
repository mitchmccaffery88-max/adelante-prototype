import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, Lock, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const STAFF_TABLE_PAGE_SIZE = 50;
export interface StaffColumn<T> {
  id: string;
  label: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  mono?: boolean;
  testId?: string;
  /** Optional hook on the sort button (keeps a pre-existing `sort-*` testid). */
  sortTestId?: string;
}
export interface StaffView<T> { id: string; label: string; matches: (row: T) => boolean; emptyState?: ReactNode }
export interface StaffRowAction { label: string; onSelect: () => void; disabled?: boolean }
const copy = { views: "Saved views", previous: "Previous page", next: "Next page", more: "More", actions: "Actions", restricted: "Restricted", page: "Page" };

/** Only caller-approved cells reach this component; hidden rows never enter it. */
export function RestrictedCell({ label = copy.restricted }: { label?: string }) {
  return <span className="inline-flex items-center gap-2 text-ink-muted"><Lock aria-label={label} role="img" className="size-4 shrink-0" /><span>{label}</span></span>;
}

export function StaffTable<T>({ rows, columns, rowKey, label, testId, rowTestId, views = [], defaultView, viewId, onViewChange, primaryAction, moreActions, moreContent, moreLabel, rowDetails, rowAttributes, emptyState }: {
  rows: readonly T[]; columns: StaffColumn<T>[]; rowKey: (row: T) => string; label: string;
  testId?: string; rowTestId?: (row: T) => string; views?: StaffView<T>[]; defaultView?: string;
  viewId?: string; onViewChange?: (id: string) => void;
  primaryAction?: (row: T) => ReactNode; moreActions?: (row: T) => StaffRowAction[];
  moreContent?: (row: T) => ReactNode; emptyState?: ReactNode;
  moreLabel?: (row: T) => string; rowDetails?: (row: T) => ReactNode;
  /** Extra data-* attributes for a row (keeps pre-existing row hooks). */
  rowAttributes?: (row: T) => Record<`data-${string}`, string | undefined>;
}) {
  const [view, setView] = useState(defaultView ?? views[0]?.id ?? "all");
  const [sort, setSort] = useState<{ id: string; descending: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const activeView = viewId ?? view;
  const selected = views.find((v) => v.id === activeView);
  const filtered = selected ? rows.filter(selected.matches) : [...rows];
  const column = columns.find((c) => c.id === sort?.id);
  const sorted = column?.sortValue ? [...filtered].sort((a, b) => {
    const av = column.sortValue?.(a) ?? ""; const bv = column.sortValue?.(b) ?? "";
    const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sort?.descending ? -comparison : comparison;
  }) : filtered;
  const pages = Math.max(1, Math.ceil(sorted.length / STAFF_TABLE_PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * STAFF_TABLE_PAGE_SIZE, (current + 1) * STAFF_TABLE_PAGE_SIZE);
  const hasActions = Boolean(primaryAction || moreActions || moreContent);
  return <div data-density="compact" className="staff-table min-w-0 space-y-3 overflow-x-auto text-sm text-ink">
    {views.length > 0 && <div role="group" aria-label={copy.views} className="sticky left-0 flex flex-wrap gap-2">
      {views.map((v) => <Button key={v.id} variant={v.id === activeView ? "secondary" : "ghost"} aria-pressed={v.id === activeView} className="text-sm" onClick={() => { setView(v.id); onViewChange?.(v.id); setPage(0); }}>{v.label} ({rows.filter(v.matches).length})</Button>)}
    </div>}
    {visible.length === 0 ? <div role="status" data-testid={testId} className="py-6 text-sm text-ink-muted">{selected?.emptyState ?? emptyState ?? "Nothing in this view."}</div> : <table aria-label={label} data-testid={testId} className="w-full border-collapse text-left">
      <thead className="bg-surface-sunk text-ink-muted"><tr>{columns.map((c) => <th key={c.id} scope="col" aria-sort={sort?.id === c.id ? sort.descending ? "descending" : "ascending" : "none"} className="px-3 py-1 font-medium">
        {c.sortValue ? <Button variant="ghost" data-testid={c.sortTestId} data-sort={c.sortTestId ? sort?.id === c.id ? sort.descending ? "desc" : "asc" : "none" : undefined} className="h-9 px-0 text-sm whitespace-normal text-left" onClick={() => { setSort({ id: c.id, descending: sort?.id === c.id ? !sort.descending : false }); setPage(0); }}>{c.label}{sort?.id === c.id ? sort.descending ? <ArrowDown /> : <ArrowUp /> : <ChevronsUpDown />}</Button> : c.label}
      </th>)}{hasActions && <th scope="col" className="min-w-32 px-3 py-2 font-medium">{copy.actions}</th>}</tr></thead>
      <tbody>{visible.map((row) => <tr key={rowKey(row)} {...rowAttributes?.(row)} data-row-key={rowKey(row)} data-testid={rowTestId?.(row)} className="h-10 border-b border-line align-top">
        {columns.map((c) => <td key={c.id} data-testid={c.testId} data-label={c.label} className={`px-3 py-2 break-words ${c.mono ? "font-mono" : ""}`}>{c.cell(row)}{c === columns[0] && rowDetails && <div className="col-span-2 min-w-0">{rowDetails(row)}</div>}</td>)}
        {hasActions && <td data-label={copy.actions} className="min-w-32 px-3 py-1"><div className="flex flex-wrap items-center gap-2">{primaryAction?.(row)}{(() => {
          const actions = moreActions?.(row) ?? [];
          return actions.length > 0 || moreContent ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={moreLabel?.(row) ?? `${copy.more}: ${rowKey(row)}`} title={copy.more}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>{actions.map((a) => <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={() => {
            // §9c-1 — let the modal menu fully close (releasing its pointer
            // lock) before the action opens a sheet/dialog; the menu's close
            // never moves focus over the opened surface.
            const select = a.onSelect;
            setTimeout(select, 0);
          }}>{a.label}</DropdownMenuItem>)}{moreContent?.(row)}</DropdownMenuContent></DropdownMenu> : null;
        })()}</div></td>}
      </tr>)}</tbody>
    </table>}
    <nav aria-label={`${label} pages`} className="sticky left-0 flex items-center justify-end gap-3 text-sm">
      <span aria-live="polite">{copy.page} {current + 1} / {pages} · {sorted.length}</span>
      <Button variant="outline" size="icon" aria-label={copy.previous} title={copy.previous} disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft /></Button>
      <Button variant="outline" size="icon" aria-label={copy.next} title={copy.next} disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}><ChevronRight /></Button>
    </nav>
  </div>;
}