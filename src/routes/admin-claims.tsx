import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt, type ClaimState } from "@/lib/ehr-ext";
import { groupTopicFor, occurrencePeers, parseGroupEncounterId } from "@/lib/groupMetrics";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UsersRound } from "lucide-react";

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

function ClaimsPage() {
  const claims = useEhrExt(() => AdelanteEHRExt.listClaims());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">Claims worklist</h1>
          <p className="text-sm text-muted-foreground">Every encounter's billing lifecycle.</p>
        </div>
        <Link to="/billing" className="text-sm underline">← Billing</Link>
      </header>

      <Card className="p-4">
        {claims.length === 0 ? (
          <p className="text-sm text-muted-foreground">No claims yet — completed encounters will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-1">Patient</th><th>Source</th><th>Clinician</th><th>State</th><th>Charge</th><th>Denial</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {claims.map((c) => {
                  const pt = patients.find((p) => p.id === c.patientId);
                  const cl = clinicians.find((x) => x.id === c.clinicianId);
                  const next = flow[c.state];
                  const groupRef = parseGroupEncounterId(c.encounterId);
                  return (
                    <tr key={c.id}>
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
    </div>
  );
}