import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { metaOf, isPart2Content, spanishStatusOf, readingLevelOf, READING_LEVEL_TARGET } from "@/lib/contentGovernance";
import { getContentEntry, type ContentEntry } from "@/lib/contentPublishing";
import { contentType } from "@/lib/contentTypes";

/** "Live (shipped)" = served from the shipped baseline, never brought under management. */
export function inventoryStatus(e: ContentEntry): string {
  if (!getContentEntry(e.typeId, e.id)) return "Live (shipped)";
  if (e.revisions.at(-1)?.action === "retired") return "Retired";
  return e.status === "published" ? "Live" : e.status === "pending_review" ? "In review" : "Draft";
}

const STATUS_FILTERS: [string, string][] = [["all", "All statuses"], ["draft", "Draft"], ["pending_review", "In review"], ["published", "Live"], ["shipped", "Live (shipped)"], ["retired", "Retired"]];
const FLAG_FILTERS: [string, string][] = [["all", "All flags"], ["part2", "Part 2"], ["clinical", "Clinical"], ["missing_es", "Spanish missing"], ["above_grade", `Above grade ${READING_LEVEL_TARGET}`]];

export function ContentInventoryTable({ entries, edit, review, canReview, canEdit = true }: { entries: ContentEntry[]; edit: (id: string) => void; review: (ids: string[], reason: string) => void; canReview: boolean; canEdit?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("all");
  const [reason, setReason] = useState("");
  const [flag, setFlag] = useState("all");
  const rows = entries.filter((e) => {
    const label = inventoryStatus(e);
    const statusOk = status === "all" || (status === "shipped" ? label === "Live (shipped)" : status === "retired" ? label === "Retired" : label !== "Live (shipped)" && label !== "Retired" && e.status === status);
    const m = metaOf(e.body);
    const flagOk = flag === "all" || (flag === "part2" && isPart2Content(e.typeId, e.body)) || (flag === "clinical" && !!m.clinical) || (flag === "missing_es" && spanishStatusOf(e.body) === "missing") || (flag === "above_grade" && readingLevelOf(e.typeId, e.body).aboveTarget);
    return statusOk && flagOk;
  });
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40" aria-label="Status filter"><SelectValue /></SelectTrigger><SelectContent>{STATUS_FILTERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={flag} onValueChange={setFlag}><SelectTrigger className="w-44" aria-label="Manage flags"><SelectValue /></SelectTrigger><SelectContent>{FLAG_FILTERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        <Input className="max-w-xs" aria-label="Review reason" placeholder="Reason for review" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button variant="outline" disabled={!canReview || !selected.length || !reason.trim()} onClick={() => { review(selected, reason); setSelected([]); setReason(""); }}>Mark reviewed ({selected.length})</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border">{["Select", "Title", "Type", "Status", "Part 2 / Clinical", "ES", "Reading level (Draft)", "Owner", "Last reviewed", "Next review", ""].map((s, i) => <th key={i} className="p-2">{s}</th>)}</tr></thead>
          <tbody>
            {rows.map((e) => {
              const m = metaOf(e.body);
              const label = inventoryStatus(e);
              const shipped = label === "Live (shipped)";
              const title = contentType(e.typeId).titleOf(e.body);
              const rl = readingLevelOf(e.typeId, e.body);
              return (
                <tr key={e.id} className="border-b border-border" data-testid="inventory-row">
                  <td className="p-2"><Checkbox aria-label={`Select ${title}`} disabled={shipped} checked={selected.includes(e.id)} onCheckedChange={(v) => setSelected((ids) => (v ? [...ids, e.id] : ids.filter((id) => id !== e.id)))} /></td>
                  <td className="p-2" data-testid="managed-title">{title}</td>
                  <td className="p-2">{contentType(e.typeId).label}</td>
                  <td className="p-2" data-testid="inventory-status">{label}</td>
                  <td className="p-2">{isPart2Content(e.typeId, e.body) && <Badge variant="outline">Part 2</Badge>}{m.clinical && <Badge variant="secondary">Clinical</Badge>}</td>
                  <td className="p-2">{spanishStatusOf(e.body)}</td>
                  <td className="p-2" data-testid="reading-grade">≈ grade {rl.grade}{rl.aboveTarget && <Badge variant="outline" className="ml-1">Above {READING_LEVEL_TARGET}</Badge>}</td>
                  <td className="p-2">{m.owner || "Unassigned"}</td>
                  <td className="p-2">{m.lastReviewed || "Not set"}</td>
                  <td className="p-2">{m.nextReview || "Not set"}</td>
                  <td className="p-2"><Button variant="outline" size="sm" disabled={!canEdit || e.status === "pending_review"} onClick={() => edit(e.id)}>Edit</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
