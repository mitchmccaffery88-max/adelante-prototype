// §Batch E — the ONE "Patient matching" review queue: every source (HIE,
// patient sign-up, staff create, referral, intake). Merge / Not the same
// person / Link as related all go through runAction and are audited.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdelanteEHR, useEhr, type Patient } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { listMatchQueue } from "@/lib/dataExchange";
import { getAfbiContact, listAfbiLinkRequests } from "@/lib/afbiOutreach";
import { KIND_LABEL } from "@/lib/hie";
import {
  canReviewMatches,
  listMatchReviews,
  matchThresholdsDraft,
  MATCH_SOURCE_LABEL,
  type MatchReview,
} from "@/lib/patientMatching";
import { canUnmerge, listMerges, previewMerge, type MergeSummary } from "@/lib/patientMerge";

const BAND_LABEL = { exact: "Exact", probable: "Probable", possible: "Possible", none: "None" } as const;
const FIELD_LABEL: Record<string, string> = { cin: "CIN", name: "Name", first_name: "First name", last_name: "Last name", dob: "Date of birth", phone: "Phone", email: "Email", address: "Address" };
const COUNT_LABEL: Record<string, string> = { appointments: "visits", referrals: "referrals", caseTasks: "tasks", patientDocuments: "documents", refillRequests: "refill requests", consentRecords: "consents", claims: "claims", labs: "lab orders", screenerRequests: "screener requests", metabolic: "measures", contacts: "contacts", episodes: "episodes", disclosures: "disclosures", progressNotes: "notes", careMessages: "messages", screenerHistory: "screener results", carePlan: "care plan" };

const all = (id: string) => AdelanteEHR._allPatientsIncludingMerged().find((p) => p.id === id);
const nm = (p?: Patient) => (p ? `${p.firstName} ${p.lastName}` : "—");

export function PatientMatchingQueue() {
  const actor = useActingStaff();
  const me = { staffId: actor.staffId, name: actor.staffName, role: actor.role };
  const reviews = useEhr(() => listMatchReviews("open"));
  const hie = useEhr(() => listMatchQueue());
  const afbiLinks = useEhr(() => listAfbiLinkRequests("open"));
  const merges = useEhr(() => listMerges().filter((m) => m.status === "active"));
  const [reason, setReason] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ reviewId: string; summary: MergeSummary } | null>(null);
  if (!canReviewMatches(actor.role)) return <p className="text-xs text-muted-foreground">Only a clinical coordinator or system admin can review matches.</p>;

  const run = (id: string, patient: Patient | undefined, via: string, args: unknown[], ok: string) => {
    const r = runAction(id, me, patient, { via, args });
    if (r.ok) toast.success(ok);
    else toast.error(r.reason);
    return r.ok;
  };

  const Pair = ({ r }: { r: MatchReview }) => {
    const a = r.newPatientId ? all(r.newPatientId) : undefined;
    const b = all(r.existingPatientId);
    const why = reason[r.id] ?? "";
    const rows: [string, string, string][] = [
      ["Name", r.attempted ? `${r.attempted.firstName} ${r.attempted.lastName}` : nm(a), nm(b)],
      ["Date of birth", (r.attempted?.dob ?? a?.dob) || "—", b?.dob ?? "—"],
      ["CIN", a?.cin ?? "—", b?.cin ?? "—"],
      ["Phone", (r.attempted?.phone ?? a?.phone) || "—", b?.phone ?? "—"],
    ];
    return (
      <div className="space-y-2 rounded-md border p-3" data-testid={`review-${r.id}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{BAND_LABEL[r.band]}</Badge>
          <span className="text-muted-foreground">{MATCH_SOURCE_LABEL[r.source]}{r.kind === "signup_attempt" ? " · sign-up stopped, person told to get sign-in help" : ""}</span>
          <span className="text-muted-foreground">Matched on: {r.fields.map((f) => `${FIELD_LABEL[f.field]} (${f.how.replace("_", " ")})`).join(", ")}</span>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th>Field</th><th>{r.kind === "signup_attempt" ? "Sign-up attempt" : "New record"}</th><th>Existing record</th></tr></thead>
          <tbody>{rows.map(([f, x, y]) => <tr key={f} className="border-t"><td>{f}</td><td>{x}</td><td>{y}</td></tr>)}</tbody>
        </table>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-8 max-w-xs text-xs" placeholder="Reason (required)" value={why} onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })} />
          {r.newPatientId && (
            <Button size="sm" onClick={() => { try { setPreview({ reviewId: r.id, summary: previewMerge(r.existingPatientId, r.newPatientId!) }); } catch (e) { toast.error((e as Error).message); } }}>Merge…</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => run("patient_match_decide", b, "markNotSamePerson", [r.id, why, me], r.kind === "signup_attempt" ? "Dismissed" : "Marked not the same person")}>
            {r.kind === "signup_attempt" ? "Dismiss" : "Not the same person"}
          </Button>
          {r.newPatientId && (
            <Button size="sm" variant="ghost" onClick={() => run("patient_match_decide", b, "linkAsRelated", [r.id, why, me], "Linked as related")}>Link as related</Button>
          )}
        </div>
        {preview?.reviewId === r.id && (
          <div className="space-y-2 rounded-md border border-dashed p-3 text-xs" data-testid="merge-summary">
            <p className="font-medium">Merge summary — keep {nm(b)} ({b?.programId ?? b?.id}); {nm(a)} becomes read-only “Merged into”.</p>
            <p>Moves: {Object.entries(preview.summary.counts).map(([k, n]) => `${n} ${COUNT_LABEL[k] ?? k}`).join(", ") || "nothing else"}.</p>
            <p>Consents needing review after merge: {preview.summary.consentsNeedingReview} · Part 2 disclosures needing review: {preview.summary.disclosuresNeedingReview} · Possible duplicate claims: {preview.summary.duplicateClaims}</p>
            <p className="text-muted-foreground">Consents are not extended. Duplicate claims are held until billing reviews.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { if (run("patient_merge", b, "mergePatients", [{ survivorId: r.existingPatientId, otherId: r.newPatientId, reason: why }, me], "Records merged")) setPreview(null); }}>Confirm merge</Button>
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3" data-testid="patient-matching">
      <p className="text-[11px] text-muted-foreground">{matchThresholdsDraft().label}</p>
      {reviews.length === 0 && hie.length === 0 && afbiLinks.length === 0 && <p className="text-xs text-muted-foreground">Nothing waiting for review.</p>}
      {reviews.map((r) => <Pair key={r.id} r={r} />)}
      {afbiLinks.map((l) => {
        const c = getAfbiContact(l.contactId);
        const p = AdelanteEHR.getPatient(l.patientId);
        return (
          <div key={l.id} className="space-y-2 rounded-md border p-3 text-xs" data-testid={`afbi-link-${l.id}`}>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Field outreach (AFBI)</Badge><span className="text-muted-foreground">Asked by {l.requestedBy} · {new Date(l.requestedAt).toLocaleDateString()}</span></div>
            <p>Contact with <span className="font-medium">{c?.initials ?? "—"}</span> on {c ? new Date(c.at).toLocaleDateString() : "—"} → link to <span className="font-medium">{nm(p)}</span> (DOB {p?.dob ?? "—"}). Never merged — only the outreach contact is attached.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => run("afbi_link_decide", p, "decideAfbiLink", [me, l.id, true], "Contact linked to the chart")}>Link to chart</Button>
              <Button size="sm" variant="outline" onClick={() => run("afbi_link_decide", p, "decideAfbiLink", [me, l.id, false], "Link declined")}>Not this person</Button>
            </div>
          </div>
        );
      })}
      {hie.map((c) => {
        const p = AdelanteEHR.getPatient(c.suggestedPatientId);
        const a = { name: actor.staffName, role: actor.role };
        return (
          <div key={c.id} className="space-y-2 rounded-md border p-3" data-testid={`match-${c.id}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{BAND_LABEL[c.band]}</Badge>
              <span className="text-muted-foreground">{MATCH_SOURCE_LABEL.hie} · {KIND_LABEL[c.record.kind]}</span>
              <span className="text-muted-foreground">Matched on: {c.fields.map((f) => FIELD_LABEL[f.field]).join(", ") || "—"}</span>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted-foreground"><th>Field</th><th>Incoming</th><th>Suggested chart</th></tr></thead>
              <tbody>
                {([["Name", c.incoming.name, nm(p)], ["Date of birth", c.incoming.dob, p?.dob ?? "—"], ["CIN", c.incoming.cin, p?.cin ?? "—"], ["Address", c.incoming.address, p?.address ?? "—"]] as const).map(([f, i, s]) => (
                  <tr key={f} className="border-t"><td>{f}</td><td>{i}</td><td>{s}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => run("hie_match_decide", p, "confirmMatch", [c.id, a], "Simulated — match confirmed")}>Confirm match</Button>
              <Input className="h-8 max-w-xs text-xs" placeholder="Reason (required)" value={reason[c.id] ?? ""} onChange={(e) => setReason({ ...reason, [c.id]: e.target.value })} />
              <Button size="sm" variant="outline" onClick={() => run("hie_match_decide", undefined, "rejectMatch", [c.id, reason[c.id] ?? "", a], "Simulated — marked not the same person")}>Not the same person</Button>
            </div>
          </div>
        );
      })}
      {merges.length > 0 && (
        <div className="space-y-2 pt-2" data-testid="recent-merges">
          <p className="text-sm font-medium">Recent merges</p>
          {merges.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
              <span>{nm(all(m.otherId))} → {nm(all(m.survivorId))} · {new Date(m.at).toLocaleDateString()} · by {m.by}</span>
              {m.status === "active" && (
                <Link to="/record/$patientId" params={{ patientId: m.survivorId }} search={{ section: "consents" } as never} className="text-teal underline">
                  Open consents
                </Link>
              )}
              {m.consentsNeedingReview > 0 && <Badge variant="outline">Consent needs review</Badge>}
              {m.flaggedClaims.length > 0 && <Badge variant="outline">Possible duplicate claim</Badge>}
              {canUnmerge(m) && (
                <>
                  <Input className="h-7 max-w-[12rem] text-xs" placeholder="Reason to undo" value={reason[m.id] ?? ""} onChange={(e) => setReason({ ...reason, [m.id]: e.target.value })} />
                  <Button size="sm" variant="outline" onClick={() => run("patient_merge", all(m.survivorId), "unmergePatients", [{ mergeId: m.id, reason: reason[m.id] ?? "" }, me], "Merge undone")}>Undo merge</Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
