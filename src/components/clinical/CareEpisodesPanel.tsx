// §B3/B4 — outpatient episodes of care + higher-level-of-care referrals on the chart.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  recordLegalDisclosureConsent,
  DISCHARGE_REASON_LABEL,
  EPISODE_PROGRAM_LABEL,
  HLOC_NEXT,
  HLOC_TARGET_LABEL,
  advanceHlocReferral,
  activeEpisode,
  canSeeSud,
  createHlocReferral,
  dischargeEpisode,
  dischargeImpact,
  hiddenHlocCount,
  hlocSendBlocker,
  openEpisode,
  readmit,
  visibleEpisodes,
  visibleHlocReferrals,
  type DischargeReason,
  type EpisodeProgram,
  type HlocReferral,
  type HlocTarget,
} from "@/lib/outpatientCare";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientDate } from "@/components/ClientDate";

const sel = "mt-0.5 h-9 w-full rounded-md border bg-background px-2 text-sm";
const CLINICAL = ["therapist", "pmhnp", "sud_counselor", "sys_admin"];

export function CareEpisodesPanel({ patientId }: { patientId: string }) {
  const { role, staffName } = useActingStaff();
  const actor = { name: staffName, role };
  const eps = useEhr(() => visibleEpisodes(patientId, role));
  const active = useEhr(() => activeEpisode(patientId));
  const sud = canSeeSud(role, patientId);
  const activeMasked = active && active.program === "outpatient_sud" && !sud;
  const [reason, setReason] = useState<DischargeReason>("completed");
  const [summary, setSummary] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [program, setProgram] = useState<EpisodeProgram>("outpatient_mh");
  const impact = dischargeImpact(patientId);
  const canAct = [...CLINICAL, "clinical_coordinator", "ecm_provider"].includes(role) && !activeMasked;
  const run = (f: () => unknown, ok: string) => {
    try {
      f();
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3" aria-label="Episodes of care">
        <h2 className="text-base font-semibold text-navy">Episodes of care</h2>
        {activeMasked ? (
          <p className="text-sm">Active in Adelante care</p>
        ) : null}
        {eps.length === 0 && !activeMasked && <p className="text-sm text-muted-foreground">No outpatient episode yet.</p>}
        <ul className="space-y-2">
          {eps.map((e) => (
            <li key={e.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-navy">{EPISODE_PROGRAM_LABEL[e.program]}</span>
                {e.closedAt ? <Badge variant="outline">Discharged</Badge> : <Badge>Active</Badge>}
                {e.readmitOf && <Badge variant="secondary">Readmission</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                Opened <ClientDate value={e.openedAt} /> by {e.openedBy}
                {e.closedAt && (
                  <>
                    {" "}· discharged <ClientDate value={e.closedAt} /> by {e.closedBy} · {DISCHARGE_REASON_LABEL[e.dischargeReason!]}
                  </>
                )}
              </div>
              {e.dischargeSummary && <p className="mt-1 text-xs">Summary: {e.dischargeSummary}</p>}
            </li>
          ))}
        </ul>
        {canAct && active && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium text-navy">Discharge</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="dc-reason" className="text-xs">Reason</Label>
                <select id="dc-reason" className={sel} value={reason} onChange={(e) => setReason(e.target.value as DischargeReason)}>
                  {Object.entries(DISCHARGE_REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <Label htmlFor="dc-summary" className="text-xs">Discharge summary</Label>
            <Textarea id="dc-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
            {!confirming ? (
              <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>Discharge episode…</Button>
            ) : (
              <div className="space-y-2 rounded-md bg-muted p-2 text-xs">
                <p>This closes {impact.openTasks} open task(s) with a discharge note and cancels {impact.futureVisits} future visit(s). The care team is notified.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => run(() => dischargeEpisode({ patientId, reason, summary, actor, confirmCancelVisits: true }), "Episode discharged") && (setConfirming(false), setSummary(""))}>
                    Confirm discharge
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep open</Button>
                </div>
              </div>
            )}
          </div>
        )}
        {canAct && !active && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="ep-program" className="text-xs">Program</Label>
              <select id="ep-program" className={sel} value={program} onChange={(e) => setProgram(e.target.value as EpisodeProgram)}>
                {Object.entries(EPISODE_PROGRAM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {eps.some((e) => e.closedAt) ? (
              <Button size="sm" onClick={() => run(() => readmit({ patientId, program, actor }), "Readmitted — new episode opened")}>Readmit</Button>
            ) : (
              <Button size="sm" onClick={() => run(() => openEpisode({ patientId, program, actor }), "Episode opened")}>Open episode</Button>
            )}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">In-facility pre-release episodes are tracked separately.</p>
      </Card>
      <HlocReferralsCard patientId={patientId} />
    </div>
  );
}

function HlocReferralsCard({ patientId }: { patientId: string }) {
  const { role, staffName } = useActingStaff();
  const actor = { name: staffName, role };
  const rows = useEhr(() => visibleHlocReferrals(role, patientId));
  const hidden = hiddenHlocCount(role, patientId);
  const canCreate = CLINICAL.includes(role);
  const asams = useEhr(() => (canSeeSud(role, patientId) ? AdelanteEHR.getPatient(patientId)?.asamAssessments ?? [] : []));
  const [f, setF] = useState({ target: "residential" as HlocTarget, reason: "", urgency: "routine" as HlocReferral["urgency"], destination: "", outside: false, asamId: "" });
  const [blockFor, setBlockFor] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const send = (r: HlocReferral, to: HlocReferral["status"]) => {
    try {
      advanceHlocReferral(r.id, to, actor, note[r.id]);
      setBlockFor(null);
      toast.success(`Referral ${to}`);
    } catch (e) {
      if (to === "sent" && hlocSendBlocker(r)) setBlockFor(r.id);
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className="p-4 space-y-3" aria-label="Higher level of care referrals">
      <h2 className="text-base font-semibold text-navy">Referrals to a higher level of care</h2>
      {hidden > 0 && <p className="text-xs text-muted-foreground">{hidden} protected referral(s) not shown for your role.</p>}
      {rows.length === 0 && hidden === 0 && <p className="text-sm text-muted-foreground">No referrals.</p>}
      {rows.map((r) => (
        <div key={r.id} className="rounded-md border p-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-navy">{HLOC_TARGET_LABEL[r.target]}</span>
            <Badge variant="outline" className="capitalize">{r.status}</Badge>
            <Badge variant={r.urgency === "routine" ? "secondary" : "destructive"} className="capitalize">{r.urgency}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            To {r.destination} · {r.reason} · by {r.createdBy}
          </div>
          <ol className="text-[11px] text-muted-foreground">
            {r.history.map((h, i) => (
              <li key={i}>
                <span className="capitalize">{h.status}</span> · <ClientDate value={h.at} /> · {h.by}
                {h.note ? ` · ${h.note}` : ""}
              </li>
            ))}
          </ol>
          {blockFor === r.id && (
            <div role="alert" className="rounded-md border border-destructive/60 bg-destructive/5 p-2 text-xs text-destructive space-y-2">
              <p>{hlocSendBlocker(r) ?? "Consent now on file — try sending again."}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/consent" search={{ patientId, category: "legal_part2_disclosure" } as never}>Open consent screen</Link>
                </Button>
              </div>
              <ConsentCapture patientId={patientId} />
            </div>
          )}
          {canCreate && HLOC_NEXT[r.status].length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <Input className="h-8 w-48" placeholder="Note (required to decline)" aria-label="Referral note" value={note[r.id] ?? ""} onChange={(e) => setNote((m) => ({ ...m, [r.id]: e.target.value }))} />
              {HLOC_NEXT[r.status].map((to) => (
                <Button key={to} size="sm" variant={to === "sent" ? "default" : "outline"} onClick={() => send(r, to)} className="capitalize">
                  {to === "sent" ? "Send" : `Mark ${to}`}
                </Button>
              ))}
            </div>
          )}
          {r.status === "admitted" && activeEpisode(patientId) && CLINICAL.includes(role) && (
            <Button size="sm" variant="outline" onClick={() => {
              try {
                dischargeEpisode({ patientId, reason: "higher_level_of_care", summary: `Admitted to ${HLOC_TARGET_LABEL[r.target]} at ${r.destination}.`, actor, confirmCancelVisits: true });
                toast.success("Episode discharged — higher level of care");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}>
              Discharge episode as higher level of care
            </Button>
          )}
        </div>
      ))}
      {canCreate && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-sm font-medium text-navy">New referral</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Label htmlFor="hl-target" className="text-xs">Target level</Label>
              <select id="hl-target" className={sel} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value as HlocTarget })}>
                {Object.entries(HLOC_TARGET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="hl-urg" className="text-xs">Urgency</Label>
              <select id="hl-urg" className={sel} value={f.urgency} onChange={(e) => setF({ ...f, urgency: e.target.value as HlocReferral["urgency"] })}>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergent">Emergent</option>
              </select>
            </div>
            {asams.length > 0 && (
              <div>
                <Label htmlFor="hl-asam" className="text-xs">Linked ASAM (optional)</Label>
                <select id="hl-asam" className={sel} value={f.asamId} onChange={(e) => setF({ ...f, asamId: e.target.value })}>
                  <option value="">None</option>
                  {asams.map((a) => <option key={a.id} value={a.id}>ASAM {a.id.slice(0, 6)}</option>)}
                </select>
              </div>
            )}
          </div>
          <Label htmlFor="hl-dest" className="text-xs">Destination provider</Label>
          <Input id="hl-dest" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={f.outside} onChange={(e) => setF({ ...f, outside: e.target.checked })} /> Outside SUD provider (needs Part 2 disclosure consent to send)
          </label>
          <Label htmlFor="hl-reason" className="text-xs">Reason</Label>
          <Textarea id="hl-reason" rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <Button size="sm" onClick={() => {
            try {
              createHlocReferral({ patientId, target: f.target, reason: f.reason, urgency: f.urgency, destination: f.destination, outsideSudProvider: f.outside, asamId: f.asamId || undefined, actor });
              setF({ ...f, reason: "", destination: "" });
              toast.success("Referral drafted");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}>
            Draft referral
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Staff capture of the signed 42 CFR Part 2 disclosure form (typed signer + attestation). */
function ConsentCapture({ patientId }: { patientId: string }) {
  const { role, staffName, staffId } = useActingStaff();
  const [name, setName] = useState("");
  const [att, setAtt] = useState(false);
  return (
    <div className="space-y-1 text-navy">
      <Label htmlFor="p2-signer" className="text-xs">Patient&apos;s typed signature on the Part 2 disclosure form</Label>
      <Input id="p2-signer" className="h-8" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={att} onChange={(e) => setAtt(e.target.checked)} /> I witnessed the patient sign this disclosure consent
      </label>
      <Button size="sm" onClick={() => {
        try {
          if (!att) throw new Error("Confirm you witnessed the signature.");
          recordLegalDisclosureConsent(patientId, { name: staffName, role, staffId }, name);
          toast.success("Part 2 disclosure consent recorded");
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}>
        Record disclosure consent
      </Button>
    </div>
  );
}
