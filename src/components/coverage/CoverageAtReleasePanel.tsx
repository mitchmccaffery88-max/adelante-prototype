// §B2 — "Coverage at release" tracker. Shown on the pre-release roster, the
// coverage worklist and /coverage-release. Eligibility check stays Simulated.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useActingStaff } from "@/lib/roles";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { act } from "@/lib/actions/act";
import {
  canSetReleaseCoverage, COVERAGE_RELEASE_DRAFT, coverageReleaseVersion, dayOffsetLabel, NEXT_ACTION_LABEL,
  RELEASE_COVERAGE_LABEL, releaseCoverageRows, type ReleaseCoverageRow, type ReleaseCoverageStatus,
} from "@/lib/coverageRelease";

export function CoverageAtReleasePanel({ compact = false }: { compact?: boolean }) {
  const me = useActingStaff();
  const rows = useEhr(() => { void coverageReleaseVersion(); return releaseCoverageRows(); });
  const [edit, setEdit] = useState<ReleaseCoverageRow | null>(null);
  const [status, setStatus] = useState<ReleaseCoverageStatus>("reactivation_submitted");
  const [source, setSource] = useState("");
  const [, bump] = useState(0);
  const mayEdit = canSetReleaseCoverage(me.role);
  const overdue = rows.filter((r) => r.escalation).length;
  const actor = { role: me.role, staffId: me.staffId, name: me.staffName };
  const save = () => {
    if (!edit) return;
    try {
      act("coverage_release_status_set", "setReleaseCoverageStatus", { episodeId: edit.episodeId, status, source }, actor);
      toast.success("Coverage updated");
      setEdit(null); setSource(""); bump((n) => n + 1);
    } catch (e) { toast.error((e as Error).message); }
  };
  const check = (r: ReleaseCoverageRow) => {
    try { act("coverage_release_check", "simulateEligibilityCheck", r.episodeId, actor); toast.success("Eligibility check (Simulated) recorded"); bump((n) => n + 1); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Card className="space-y-3 p-4" data-testid="coverage-at-release">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Coverage at release</h2>
        <div className="flex gap-2">
          {overdue > 0 && <Badge variant="destructive">{overdue} overdue reactivation{overdue === 1 ? "" : "s"}</Badge>}
          <Badge variant="outline">{COVERAGE_RELEASE_DRAFT.label}</Badge>
          {compact && <Link to="/coverage-release" className="text-sm underline">Open tracker</Link>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Task 30 days before release if nothing is submitted; escalation at release + 3 days if not Active; flagged at release + 10. Eligibility check is Simulated.</p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No one with a release date.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th>Patient</th><th>Release date</th><th>Status</th><th>Days</th><th>Next action</th><th>Owner</th><th /></tr></thead>
            <tbody>
              {(compact ? rows.slice(0, 5) : rows).map((r) => (
                <tr key={r.episodeId} className="border-t" data-testid="coverage-release-row">
                  <td className="py-1.5">{r.patientName}</td>
                  <td>{r.releaseDate}{r.released ? "" : " (expected)"}</td>
                  <td><span>{r.statusLabel}</span><div className="text-xs text-muted-foreground">{r.source} · {r.statusAt}</div></td>
                  <td>{dayOffsetLabel(r.dayOffset)}</td>
                  <td>{r.escalation ? <Badge variant="destructive">Overdue — {NEXT_ACTION_LABEL[r.nextAction]}</Badge> : NEXT_ACTION_LABEL[r.nextAction]}{r.flagged && <Badge variant="outline" className="ml-1">10+ days</Badge>}</td>
                  <td>{r.ownerName}</td>
                  <td className="whitespace-nowrap">{mayEdit && <><Button size="sm" variant="outline" onClick={() => { setEdit(r); setStatus(r.status); }}>Update</Button> <Button size="sm" variant="ghost" onClick={() => check(r)}>Check (Simulated)</Button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>Coverage at release — {edit?.patientName}</SheetTitle><SheetDescription>Every status needs a source. Audited.</SheetDescription></SheetHeader>
          <div className="mt-4 space-y-3">
            <Label htmlFor="cr-status">Status</Label>
            <select id="cr-status" className="w-full rounded-md border bg-background p-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as ReleaseCoverageStatus)}>
              {(Object.keys(RELEASE_COVERAGE_LABEL) as ReleaseCoverageStatus[]).map((s) => <option key={s} value={s}>{RELEASE_COVERAGE_LABEL[s]}</option>)}
            </select>
            <Label htmlFor="cr-source">Source</Label>
            <Input id="cr-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. County portal, BenefitsCal confirmation" />
            <Button onClick={save} disabled={!source.trim()}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
