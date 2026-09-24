// §Phase 3c — program-level Medi-Cal verification worklist.
//
// PLACEMENT: its own page in the Revenue & consent group, gated on the real
// `eligibility` record class (the same class that already governs Medi-Cal
// Actions). It is deliberately NOT folded into /worklist: that page is a
// CaseTask table — one row per task, claim/complete semantics — and the
// primary finding here ("nobody has ever recorded a check for this person")
// has no task row behind it and never will unless someone creates one. The
// Phase 3a follow-up tasks that DO exist stay owned by /worklist; this page
// links out to them rather than cloning claim/complete behaviour.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  COVERAGE_CHECK_STATE_LABEL,
  COVERAGE_FOLLOW_UP_TASK_LABEL,
  COVERAGE_STALENESS_DRAFT,
  coverageWorklistCounties,
  coverageWorklistRows,
  coverageWorklistSummary,
  type CoverageCheckState,
} from "@/lib/coverageWorklist";
import { COVERAGE_CHECK_CHANNEL_LABEL, REPORTED_SOURCE_LABEL } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { ClientDate } from "@/components/ClientDate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CoverageCheckDialog } from "@/components/coverage/CoverageCheckDialog";
import { ListChecks, Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/eligibility-worklist")({
  head: () => ({
    meta: [
      { title: "Medi-Cal verification worklist — Adelante" },
      {
        name: "description",
        content:
          "Program-level Medi-Cal eligibility worklist: who has never had a check recorded, whose last check is overdue, and which coverage follow-ups are still open.",
      },
      { property: "og:title", content: "Medi-Cal verification worklist — Adelante" },
      {
        property: "og:description",
        content: "Never-checked, overdue and open coverage follow-ups across the whole caseload.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EligibilityWorklistPage,
});

const STATE_TONE: Record<CoverageCheckState, string> = {
  never_checked: "bg-destructive/15 text-destructive border-0",
  needs_verification: "bg-warning/25 text-navy border-0",
  not_medi_cal_reported: "bg-secondary text-muted-foreground border-0",
  overdue: "bg-destructive/10 text-destructive border-0",
  due: "bg-warning/20 text-navy border-0",
  current: "bg-muted text-muted-foreground border-0",
};

function EligibilityWorklistPage() {
  const acting = useActingStaff();
  const access = canAccess(acting.role, "eligibility");
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const tasks = useEhr(() => AdelanteEHR.listCaseTasks());
  const [county, setCounty] = useState("all");
  const [state, setState] = useState<"all" | "needs_work" | CoverageCheckState>("needs_work");
  const [q, setQ] = useState("");
  const [checkFor, setCheckFor] = useState<string | null>(null);

  const allRows = useMemo(
    () => coverageWorklistRows(patients, tasks),
    [patients, tasks],
  );
  const counties = useMemo(() => coverageWorklistCounties(allRows), [allRows]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allRows.filter((r) => {
      if (county !== "all" && r.county !== county) return false;
      if (state === "needs_work" && (r.state === "current" || r.state === "not_medi_cal_reported")) return false;
      if (state !== "all" && state !== "needs_work" && r.state !== state) return false;
      if (needle && !`${r.name} ${r.programId}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [allRows, county, state, q]);
  const summary = useMemo(() => coverageWorklistSummary(rows), [rows]);

  if (access.level === "none") {
    return (
      <div className="p-6">
        <EmptyState
          icon={Lock}
          title="Not available for your role"
          description="The Medi-Cal verification worklist is limited to the roles that record eligibility checks."
        />
      </div>
    );
  }

  const canRecord = access.level === "write";

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl text-navy flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-teal" /> Medi-Cal verification worklist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everyone in the program, worst first: never checked, then reported but not yet verified,
          then the oldest checks. Built from
          the eligibility checks staff have actually recorded — there is no automated eligibility
          transaction in this app, so nothing on this list updates itself.
        </p>
      </div>

      <Card className="p-3 text-xs text-muted-foreground" data-testid="staleness-policy">
        <strong className="text-navy">{COVERAGE_STALENESS_DRAFT.label}.</strong>{" "}
        {COVERAGE_STALENESS_DRAFT.note}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-3" data-testid="coverage-summary">
        <Stat label="On this list" value={summary.total} />
        <Stat label="Never checked" value={summary.neverChecked} tone="destructive" />
        <Stat label="Needs verification" value={summary.needsVerification} />
        <Stat label="Not Medi-Cal (reported)" value={summary.notMediCalReported} />
        <Stat label="Overdue" value={summary.overdue} tone="destructive" />
        <Stat label="Due" value={summary.due} />
        <Stat label="Open follow-ups" value={summary.openFollowUps} />
      </div>

      <Card className="p-3 flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground" htmlFor="cw-search">
            Search name or program ID
          </label>
          <Input
            id="cw-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="mt-1"
          />
        </div>
        <div className="w-full md:w-52">
          <label className="text-xs text-muted-foreground">County</label>
          <Select value={county} onValueChange={setCounty}>
            <SelectTrigger className="mt-1" aria-label="County">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counties</SelectItem>
              {counties.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-56">
          <label className="text-xs text-muted-foreground">Check status</label>
          <Select value={state} onValueChange={(v) => setState(v as typeof state)}>
            <SelectTrigger className="mt-1" aria-label="Check status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="needs_work">Needs a check</SelectItem>
              <SelectItem value="never_checked">Never checked</SelectItem>
              <SelectItem value="needs_verification">Needs verification</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due">Due</SelectItem>
              <SelectItem value="current">Current</SelectItem>
              <SelectItem value="not_medi_cal_reported">Not Medi-Cal (reported)</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing matches"
          description="No patient matches these filters. Widen the county or status filter."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="coverage-worklist-table">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Patient</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Last recorded check</th>
                <th className="text-left px-3 py-2">Coverage on file</th>
                <th className="text-left px-3 py-2">Open follow-ups</th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.patientId} className="border-t align-top">
                  <td className="px-3 py-2">
                    <Link
                      to="/record/$patientId"
                      params={{ patientId: r.patientId }}
                      className="text-navy underline underline-offset-2"
                    >
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.programId}
                      {r.county ? ` · ${r.county} County` : ""}
                      {r.cinOnFile ? " · CIN on file" : " · no CIN"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={STATE_TONE[r.state]}>
                      {COVERAGE_CHECK_STATE_LABEL[r.state]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.pendingReport && (
                      <div className="mb-1 text-foreground" data-testid="pending-report">
                        {REPORTED_SOURCE_LABEL[r.pendingReport.reportSource]} ·{" "}
                        <ClientDate value={r.pendingReport.checkedAt} /> · by {r.pendingReport.checkedBy} — not verified
                      </div>
                    )}
                    {r.lastCheck ? (
                      <>
                        <ClientDate value={r.lastCheck.checkedAt} />
                        {typeof r.daysSinceCheck === "number" ? ` · ${r.daysSinceCheck}d ago` : ""}
                        <div>
                          {r.lastCheck.checkedBy} ·{" "}
                          {COVERAGE_CHECK_CHANNEL_LABEL[r.lastCheck.channel]} · result{" "}
                          {r.lastCheck.result}
                        </div>
                      </>
                    ) : (
                      "No eligibility check has ever been recorded."
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <span className="capitalize text-foreground">{r.coverageStatus}</span>
                    <div>{r.activePlanPayer ?? "No plan span on file"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.openFollowUps.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {r.openFollowUps.map((t) => (
                          <li key={t.id}>
                            {COVERAGE_FOLLOW_UP_TASK_LABEL[t.taskType ?? ""] ?? t.title}
                            <span className="text-muted-foreground">
                              {t.dueDate ? ` · due ${t.dueDate}` : " · no due date"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canRecord ? (
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`record-check-${r.patientId}`}
                        onClick={() => setCheckFor(r.patientId)}
                      >
                        Record check
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Read only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Follow-up tasks shown here are the same rows as on the{" "}
        <Link to="/worklist" className="underline underline-offset-2">
          Worklist
        </Link>
        , where they are claimed and completed. This page does not duplicate that.
      </p>

      {checkFor && (
        <CoverageCheckDialog
          patientId={checkFor}
          open
          onOpenChange={(o) => !o && setCheckFor(null)}
          actor={{ actorId: acting.staffName, actorRole: acting.role }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive";
}) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`font-display text-2xl ${tone === "destructive" ? "text-destructive" : "text-navy"}`}
      >
        {value}
      </div>
    </Card>
  );
}
