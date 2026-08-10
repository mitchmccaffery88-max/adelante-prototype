import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt, type ClaimState } from "@/lib/ehr-ext";
import { CHW_CODES, PEER_CODES } from "@/lib/communityBilling";
import { groupTopicFor, occurrencePeers, parseGroupEncounterId } from "@/lib/groupMetrics";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, UsersRound } from "lucide-react";

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

/** Small segmented-control button; plain <button> so it stays trivially clickable. */
function FilterChip({
  active, onClick, testId, children,
}: { active: boolean; onClick: () => void; testId: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-active={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ClaimsPage() {
  const claims = useEhrExt(() => AdelanteEHRExt.listClaims());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const [service, setService] = useState<ServiceFilter>("all");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
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
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Service line</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={service === "all"} onClick={() => setService("all")} testId="filter-service-all">
              All
            </FilterChip>
            <FilterChip active={service === "peer"} onClick={() => setService("peer")} testId="filter-service-peer">
              Peer · H0038 / H0025
            </FilterChip>
            <FilterChip active={service === "chw"} onClick={() => setService("chw")} testId="filter-service-chw">
              CHW · G0019 / G0022
            </FilterChip>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outcome</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={outcome === "all"} onClick={() => setOutcome("all")} testId="filter-outcome-all">
              All claims
            </FilterChip>
            <FilterChip active={outcome === "submitted"} onClick={() => setOutcome("submitted")} testId="filter-outcome-submitted">
              Submitted
            </FilterChip>
            <FilterChip active={outcome === "blocked"} onClick={() => setOutcome("blocked")} testId="filter-outcome-blocked">
              Blocked attempts ({visibleBlocked.length})
            </FilterChip>
          </div>
        </div>
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