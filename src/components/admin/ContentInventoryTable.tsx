import { StaffTable } from "@/components/staff/StaffTable";
import { CONTENT_AUDIENCES, audiencesOf } from "@/lib/contentAudience";
import { StatusChip } from "@/components/ui/status-chip";
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

function audienceLabel(body: unknown): string {
  const aud = audiencesOf(body);
  return aud.length ? aud.map((id) => CONTENT_AUDIENCES.find((a) => a.id === id)?.label ?? id).join(", ") : "Everyone";
}

export function ContentInventoryTable({ entries, edit, review, canReview, canEdit = true }: { entries: ContentEntry[]; edit: (id: string) => void; review: (ids: string[], reason: string) => void; canReview: boolean; canEdit?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("all");
  const [reason, setReason] = useState("");
  const [flag, setFlag] = useState("all");
  const [audience, setAudience] = useState("all");
  const rows = entries.filter((e) => {
    const label = inventoryStatus(e);
    const statusOk = status === "all" || (status === "shipped" ? label === "Live (shipped)" : status === "retired" ? label === "Retired" : label !== "Live (shipped)" && label !== "Retired" && e.status === status);
    const m = metaOf(e.body);
    const flagOk = flag === "all" || (flag === "part2" && isPart2Content(e.typeId, e.body)) || (flag === "clinical" && !!m.clinical) || (flag === "missing_es" && spanishStatusOf(e.body) === "missing") || (flag === "above_grade" && readingLevelOf(e.typeId, e.body).aboveTarget);
    const aud = audiencesOf(e.body);
    const audienceOk = audience === "all" || (audience === "everyone" ? aud.length === 0 : aud.includes(audience as never));
    return statusOk && flagOk && audienceOk;
  });
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40" aria-label="Status filter"><SelectValue /></SelectTrigger><SelectContent>{STATUS_FILTERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={flag} onValueChange={setFlag}><SelectTrigger className="w-44" aria-label="Manage flags"><SelectValue /></SelectTrigger><SelectContent>{FLAG_FILTERS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={audience} onValueChange={setAudience}><SelectTrigger className="w-44" aria-label="Who it's for filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Anyone it's for</SelectItem><SelectItem value="everyone">Everyone</SelectItem>{CONTENT_AUDIENCES.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent></Select>
        <Input className="max-w-xs" aria-label="Review reason" placeholder="Reason for review" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button variant="outline" disabled={!canReview || !selected.length || !reason.trim()} onClick={() => { review(selected, reason); setSelected([]); setReason(""); }}>Mark reviewed ({selected.length})</Button>
      </div>
      <StaffTable rows={rows} rowKey={(e) => `${e.typeId}:${e.id}`} label="Content inventory" testId="content-inventory-table" rowTestId={() => "inventory-row"}
        views={[{ id: "current", label: "Current view", matches: () => true }, { id: "review", label: "In review", matches: (e) => inventoryStatus(e) === "In review" }]} defaultView="current"
        emptyState="No content matches these filters."
        columns={[
          { id: "select", label: "Select", cell: (e) => <Checkbox aria-label={`Select ${contentType(e.typeId).titleOf(e.body)}`} disabled={inventoryStatus(e) === "Live (shipped)"} checked={selected.includes(e.id)} onCheckedChange={(v) => setSelected((ids) => v ? [...ids, e.id] : ids.filter((id) => id !== e.id))} /> },
          { id: "title", label: "Title", testId: "managed-title", sortValue: (e) => contentType(e.typeId).titleOf(e.body), cell: (e) => contentType(e.typeId).titleOf(e.body) },
          { id: "type", label: "Type", sortValue: (e) => contentType(e.typeId).label, cell: (e) => contentType(e.typeId).label },
          { id: "status", label: "Status", testId: "inventory-status", sortValue: inventoryStatus, cell: (e) => { const label = inventoryStatus(e); const shipped = label === "Live (shipped)"; return <StatusChip lang="en" state={label === "Retired" ? "closed" : shipped || e.status === "published" ? "done" : e.status === "pending_review" ? "team" : "upnext"} label={e.status === "pending_review" && !shipped && label !== "Retired" ? "In clinical review" : label} />; } },
          { id: "flags", label: "Part 2 / Clinical", sortValue: (e) => `${isPart2Content(e.typeId, e.body)}:${!!metaOf(e.body).clinical}`, cell: (e) => <>{isPart2Content(e.typeId, e.body) && <Badge variant="outline">Part 2</Badge>}{metaOf(e.body).clinical && <Badge variant="secondary">Clinical</Badge>}</> },
          { id: "audience", label: "Who it's for", testId: "inventory-audiences", sortValue: (e) => audienceLabel(e.body), cell: (e) => audienceLabel(e.body) },
          { id: "es", label: "ES", sortValue: (e) => spanishStatusOf(e.body), cell: (e) => spanishStatusOf(e.body) },
          { id: "reading", label: "Reading level (Draft)", testId: "reading-grade", sortValue: (e) => readingLevelOf(e.typeId, e.body).grade, cell: (e) => { const rl = readingLevelOf(e.typeId, e.body); return <>≈ grade {rl.grade}{rl.aboveTarget && <Badge variant="outline" className="ml-1">Above {READING_LEVEL_TARGET}</Badge>}</>; } },
          { id: "owner", label: "Owner", sortValue: (e) => metaOf(e.body).owner || "Unassigned", cell: (e) => metaOf(e.body).owner || "Unassigned" },
          { id: "reviewed", label: "Last reviewed", sortValue: (e) => metaOf(e.body).lastReviewed || "", cell: (e) => metaOf(e.body).lastReviewed || "Not set" },
          { id: "next", label: "Next review", sortValue: (e) => metaOf(e.body).nextReview || "", cell: (e) => metaOf(e.body).nextReview || "Not set" },
        ]}
        primaryAction={(e) => <Button variant="outline" size="sm" disabled={!canEdit || e.status === "pending_review"} onClick={() => edit(e.id)}>Edit</Button>}
      />
    </section>
  );
}
