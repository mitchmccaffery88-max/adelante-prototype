import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt, type ClaimState } from "@/lib/ehr-ext";
import { CHW_CODES, PEER_CODES } from "@/lib/communityBilling";
import { groupTopicFor, occurrencePeers, parseGroupEncounterId } from "@/lib/groupMetrics";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, UsersRound } from "lucide-react";

export const Route = createFileRoute("/admin-claims")({
  head: () => ({
    meta: [
      { title: "Claims Worklist — Adelante" },
      { name: "description", content: "Track charges from documentation to payment." },
    ],
  }),
  component: ClaimsPage,
});

const flow: Record<ClaimState, ClaimState | null> = {
  documented: "signed",
  signed: "coded",
  coded: "generated",
  generated: "submitted",
  submitted: "paid",
  paid: null,
  denied: null,
  partial: null,
};

const stateStyle: Record<ClaimState, string> = {
  documented: "bg-muted text-muted-foreground",
  signed: "bg-teal/15 text-teal",
  coded: "bg-teal/15 text-teal",
  generated: "bg-navy/10 text-navy",
  submitted: "bg-navy/10 text-navy",
  paid: "bg-success/20 text-success",
  denied: "bg-destructive/15 text-destructive",
  partial: "bg-gold/20 text-navy",
};

// §Group C — service-line filters read the `serviceCode` the Phase 3 hooks
// already stamp on the claim. No new status field: "submitted" is the
// existing `ClaimState` lifecycle, and "blocked" attempts never became claims
// at all — they live in the audit stream as `community_billing_blocked`.
const PEER_CODE_LIST: string[] = [PEER_CODES.individual, PEER_CODES.group];
const CHW_CODE_LIST: string[] = [CHW_CODES.initiating, CHW_CODES.additional];
type ServiceFilter = "all" | "peer" | "chw";
type OutcomeFilter = "all" | "submitted" | "blocked";
/** Claim states that mean the charge actually went out the door. */
const SUBMITTED_STATES: ClaimState[] = ["submitted", "paid", "denied", "partial"];

/**
 * Segmented control on a real Radix `ToggleGroup`.
 *
 * §Group C follow-up — Group C had substituted plain buttons after clicks
 * appeared to do nothing. Root cause was the harness, not Radix: the toggle
 * group is `type="single"`, which emits `""` when you click the ALREADY
 * selected item (deselect), and Playwright's default `.click()` lands on the
 * item that is already on. Guarding the empty value here (a required part of
 * a single-select segmented control) makes the control behave; the earlier
 * "unclickable" reading was a mis-diagnosis.
 */
function SegmentedFilter<T extends string>({
  label,
  value,
  onChange,
  options,
  idPrefix,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  idPrefix: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <ToggleGroup
        type="single"
        value={value}
        // Single-select semantics: ignore the deselect event so one option is
        // always active. Without this the control looks "dead" on re-click.
        onValueChange={(v) => {
          if (v) onChange(v as T);
        }}
        className="flex-wrap justify-start gap-1.5"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            size="sm"
            data-testid={`${idPrefix}-${o.value}`}
            data-active={value === o.value}
            className={cn(
              "h-auto rounded-full border border-border px-3 py-1 text-xs text-muted-foreground",
              "data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
            )}
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

// §Group C follow-up — column sorting. Sort keys map to the columns the
// worklist already renders; comparators pull the same display value the cell
// shows so what you sort is what you see.
type SortKey = "patient" | "code" | "clinician" | "state" | "charge";
type SortDir = "asc" | "desc";

/**
 * Pure comparator layer so sorting is unit-testable without rendering.
 * `label` resolves the display string for the name columns; sorting on the
 * value the cell shows avoids the classic "sorted by hidden id" surprise.
 */
export function sortClaimRows<T>(
  rows: T[],
  sort: { key: SortKey; dir: SortDir } | null,
  value: (row: T, key: SortKey) => string | number,
): T[] {
  if (!sort) return rows;
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = value(a, sort.key);
    const bv = value(b, sort.key);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
  });
}

/** Click cycles asc -> desc -> asc on the same column; a new column starts asc. */
export function nextSort(
  current: { key: SortKey; dir: SortDir } | null,
  key: SortKey,
): { key: SortKey; dir: SortDir } {
  if (current?.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: "asc" };
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir } | null;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn("h-8 px-2 text-xs", className)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        data-testid={`sort-${sortKey}`}
        data-sort={active ? sort.dir : "none"}
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <Icon className="h-3 w-3" aria-hidden />
      </button>
    </TableHead>
  );
}

function ClaimsPage() {
  const claims = useEhrExt(() => AdelanteEHRExt.listClaims());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const [service, setService] = useState<ServiceFilter>("all");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const blockedAttempts = useEhr(() =>
    AdelanteEHR.listAuditEvents({ category: "clinical" }).filter(
      (e) => e.action === "community_billing_blocked",
    ),
  );

  const visibleClaims = claims.filter((c) => {
    if (service === "peer" && !PEER_CODE_LIST.includes(c.serviceCode ?? "")) return false;
    if (service === "chw" && !CHW_CODE_LIST.includes(c.serviceCode ?? "")) return false;
    if (outcome === "submitted" && !SUBMITTED_STATES.includes(c.state)) return false;
    return true;
  });
  const visibleBlocked = blockedAttempts.filter((e) => {
    const svc = e.detail?.["service"];
    if (service === "peer" && svc !== "peer_support") return false;
    if (service === "chw" && svc !== "chw_services") return false;
    return true;
  });
  const showBlocked = outcome === "blocked";

  const patientLabel = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : "";
  };
  const sortedClaims = useMemo(
    () =>
      sortClaimRows(visibleClaims, sort, (c, key) => {
        switch (key) {
          case "patient":
            return patientLabel(c.patientId);
          case "code":
            return c.serviceCode ?? "";
          case "clinician":
            return clinicians.find((x) => x.id === c.clinicianId)?.name ?? "";
          case "state":
            return c.state;
          case "charge":
            return c.chargeCents;
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleClaims, sort, patients, clinicians],
  );

  // De-identified export, same shape/discipline as the caseload CSV on /admin:
  // program ID only, plus the group provenance the worklist shows on screen.
  const downloadCsv = () => {
    const headers = [
      "Program ID",
      "Clinician",
      "State",
      "Charge (USD)",
      "Denial reason",
      "Group-sourced",
      "Group session ID",
      "Occurrence start",
    ];
    const rows = visibleClaims.map((c) => {
      const pt = patients.find((p) => p.id === c.patientId);
      const cl = clinicians.find((x) => x.id === c.clinicianId);
      const g = parseGroupEncounterId(c.encounterId);
      return [
        pt?.programId ?? "",
        cl?.name ?? "",
        c.state,
        (c.chargeCents / 100).toFixed(2),
        c.denialReason ?? "",
        g ? "Yes" : "No",
        g?.sessionId ?? "",
        g?.occurrenceStart ?? "",
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adelante-claims-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">Claims worklist</h1>
          <p className="text-sm text-muted-foreground">Every encounter's billing lifecycle.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={visibleClaims.length === 0}
            onClick={downloadCsv}
            data-testid="claims-export-csv"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
          <Link to="/billing" className="text-sm underline">← Billing</Link>
        </div>
      </header>

      <Card className="flex flex-wrap items-center gap-6 p-3">
        <SegmentedFilter<ServiceFilter>
          label="Service line"
          idPrefix="filter-service"
          value={service}
          onChange={setService}
          options={[
            { value: "all", label: "All" },
            { value: "peer", label: "Peer · H0038 / H0025" },
            { value: "chw", label: "CHW · G0019 / G0022" },
          ]}
        />
        <SegmentedFilter<OutcomeFilter>
          label="Outcome"
          idPrefix="filter-outcome"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "all", label: "All claims" },
            { value: "submitted", label: "Submitted" },
            { value: "blocked", label: `Blocked attempts (${visibleBlocked.length})` },
          ]}
        />
      </Card>

      {showBlocked ? (
        <Card className="p-4" data-testid="blocked-attempts-panel">
          <p className="mb-2 text-xs text-muted-foreground">
            Refused claim attempts. These never became claims — each row is the audit entry the
            billing rule wrote at the moment of the block.
          </p>
          {visibleBlocked.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked attempts recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-1">Program ID</th><th>Service</th><th>Reason code</th><th>Reason</th></tr>
              </thead>
              <tbody className="divide-y">
                {visibleBlocked.map((e) => {
                  const pt = patients.find((p) => p.id === e.patientId);
                  return (
                    <tr key={e.id} data-testid="blocked-attempt-row">
                      <td className="py-2 font-mono text-xs">{pt?.programId ?? "—"}</td>
                      <td className="text-xs">{String(e.detail?.["service"] ?? "")}</td>
                      <td>
                        <Badge className="bg-destructive/15 text-destructive font-mono text-[10px]">
                          {String(e.detail?.["reasonCode"] ?? "blocked")}
                        </Badge>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {String(e.detail?.["reason"] ?? "")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
      <Card className="p-4">
        {visibleClaims.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {claims.length === 0
              ? "No claims yet — completed encounters will appear here."
              : "No claims match the current filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-1">Patient</th><th>Source</th><th>Code</th><th>Clinician</th><th>State</th><th>Charge</th><th>Denial</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {visibleClaims.map((c) => {
                  const pt = patients.find((p) => p.id === c.patientId);
                  const cl = clinicians.find((x) => x.id === c.clinicianId);
                  const next = flow[c.state];
                  const groupRef = parseGroupEncounterId(c.encounterId);
                  return (
                    <tr key={c.id} data-testid="claim-row">
                      <td className="py-2">{pt?.firstName} {pt?.lastName}</td>
                      <td>
                        {groupRef ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2">
                                <UsersRound className="h-3.5 w-3.5 text-teal" />
                                <Badge className="bg-teal/15 text-teal">Group</Badge>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 text-xs">
                              {/* Per-attendee billing: each present attendee has their own
                                  individualized note and their own claim. Peers are shown by
                                  program ID only — group membership is disclosure-sensitive. */}
                              <p className="font-medium text-navy">
                                {groupTopicFor(groupRef.sessionId) ?? "Group session"}
                              </p>
                              <p className="mt-0.5 text-muted-foreground">
                                {groupRef.occurrenceStart.slice(0, 16).replace("T", " ")}
                              </p>
                              <p className="mt-2 font-medium text-navy">Others present</p>
                              {(() => {
                                const peers = occurrencePeers(groupRef);
                                if (peers.length === 0)
                                  return <p className="text-muted-foreground">No other attendees recorded.</p>;
                                return (
                                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                                    {peers.map((p) => (
                                      <li key={p.patientId} className="font-mono">
                                        {p.programId} · {p.status}
                                      </li>
                                    ))}
                                  </ul>
                                );
                              })()}
                              <p className="mt-2 text-[10px] italic text-muted-foreground">
                                Billing code pending — no CPT/H-code is assigned to group services yet.
                              </p>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-xs text-muted-foreground">1:1</span>
                        )}
                      </td>
                      <td className="font-mono text-xs">
                        {c.serviceCode ? `${c.serviceCode}${c.units ? ` ×${c.units}` : ""}` : "—"}
                      </td>
                      <td>{cl?.name}</td>
                      <td><Badge className={stateStyle[c.state]}>{c.state}</Badge></td>
                      <td>${(c.chargeCents / 100).toFixed(2)}</td>
                      <td>{c.denialReason ?? "—"}</td>
                      <td className="text-right space-x-2">
                        {next && (
                          <Button size="sm" variant="outline" onClick={() => { AdelanteEHRExt.advanceClaim(c.id, next, "billing_coordinator"); toast.success(`→ ${next}`); }}>
                            → {next}
                          </Button>
                        )}
                        {(c.state === "submitted" || c.state === "generated") && (
                          <Button size="sm" variant="ghost" onClick={() => { AdelanteEHRExt.advanceClaim(c.id, "denied", "billing_coordinator", "Auth required"); toast.error("Marked denied"); }}>
                            Deny
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      )}
    </div>
  );
}