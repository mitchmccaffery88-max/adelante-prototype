// §Batch E1 — nursing UI: chain badges on orders, the chart "Nursing"
// section, the nurse "Needs my action" list and the "+ New" drawer forms.
// Every write goes through the registry + runAction (act). Draft labels shown.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { act } from "@/lib/actions/act";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { getStaffMember, STAFF_ROSTER, useActingStaff } from "@/lib/roles";
import {
  clinicOrders,
  dosesFor,
  listSpecimens,
  listTriageCalls,
  nurseQueue,
  nurseReviewFor,
  NURSING_DRAFT_LABEL,
  specimenLabel,
  LVN_SUPERVISOR_ROLES,
  TRIAGE_DISPOSITION_LABEL,
  type NurseQueueRow,
  type TriageDisposition,
} from "@/lib/nursing";
import { listLabOrders, labTest } from "@/lib/chartOrders";
import { canDoChartAction } from "@/lib/chartActions";
import { listExternalNtpMeds, METHADONE_GUARD_DRAFT } from "@/lib/ntpReferral";
import { DEMO_NTP_ID, partnerOrg } from "@/lib/carePartners";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Done = (message: string, sectionId: string) => void;
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function useActor() {
  const { role, staffId, staffName } = useActingStaff();
  return { role, staffId, name: staffName };
}
const fail = (e: unknown) => toast.error((e as Error).message);

export function ClinicChainBadges({ orderId, orderedBy }: { orderId: string; orderedBy?: string }) {
  useEhr(() => 0);
  const rv = nurseReviewFor(orderId);
  const given = dosesFor(orderId)[0];
  return (
    <>
      <Badge variant="outline">Given in clinic</Badge>
      {orderedBy && <Badge variant="outline" data-testid="ordered-by-badge">Ordered by {orderedBy}</Badge>}
      {!rv && <Badge variant="secondary">Awaiting nurse review</Badge>}
      {rv?.decision === "verified" && <Badge variant="outline">Verified by {rv.by}</Badge>}
      {rv?.decision === "returned" && <Badge variant="destructive">Returned by {rv.by}</Badge>}
      {given && (
        <Badge variant="outline" data-testid="dose-given-badge">
          Given by {given.by}
          {given.cosign ? ` · cosign ${given.cosign.status === "signed" ? `by ${given.cosign.by}` : "pending"}` : ""}
        </Badge>
      )}
    </>
  );
}

/** One row of the chain with the step the acting person can take. */
export function NurseQueueList({ rows, showPatient = true }: { rows: NurseQueueRow[]; showPatient?: boolean }) {
  const actor = useActor();
  const me = getStaffMember(actor.staffId);
  const [note, setNote] = useState<Record<string, string>>({});
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing waiting on you.</p>;
  const run = (fn: () => void, msg: string) => {
    try {
      fn();
      toast.success(msg);
    } catch (e) {
      fail(e);
    }
  };
  return (
    <ul className="space-y-2" data-testid="nurse-queue">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border bg-card p-3 text-sm" data-testid={`nurse-row-${r.kind}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{showPatient ? r.label : r.label.split(" — ").slice(1).join(" — ")}</span>
            <Link to="/record/$patientId" params={{ patientId: r.patientId }} className="text-xs underline">
              Open chart
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {r.kind === "review" && (
              <>
                <Button size="sm" data-testid="nurse-verify" onClick={() => run(() => act("nurse_review", "nurseReviewOrder", { patientId: r.patientId, orderId: r.orderId, decision: "verified", actor }), "Order verified — ready to give")}>
                  Verify
                </Button>
                <Input className="h-8 max-w-[200px]" placeholder="Reason to return" value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} />
                <Button size="sm" variant="outline" onClick={() => run(() => act("nurse_review", "nurseReviewOrder", { patientId: r.patientId, orderId: r.orderId, decision: "returned", note: note[r.id], actor }), "Order returned to prescriber")}>
                  Return
                </Button>
              </>
            )}
            {r.kind === "administer" && (
              <Button
                size="sm"
                data-testid="nurse-give"
                onClick={() =>
                  run(
                    () => act("clinic_dose_give", "administerClinicDose", { patientId: r.patientId, orderId: r.orderId, supervisorStaffId: me?.supervisedBy, actor }),
                    actor.role === "lvn" ? `Dose recorded — routed to ${getStaffMember(me?.supervisedBy)?.name ?? "supervisor"} for cosign` : "Dose recorded",
                  )
                }
              >
                Give dose{actor.role === "lvn" ? " (routes for cosign)" : ""}
              </Button>
            )}
            {r.kind === "cosign" && (
              <Button size="sm" data-testid="nurse-cosign" onClick={() => run(() => act("clinic_dose_cosign", "cosignClinicDose", { doseId: r.doseId, actor }), "Dose cosigned")}>
                Cosign
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Chart "Nursing" section (Medications tab). */
export function NursingSection({ patientId }: { patientId: string }) {
  const actor = useActor();
  const orders = useEhr(() => clinicOrders(patientId, actor.role));
  const rows = useEhr(() => nurseQueue({ role: actor.role, staffId: actor.staffId }).filter((r) => r.patientId === patientId));
  const specimens = useEhr(() => listSpecimens(patientId, actor.role));
  const calls = useEhr(() => listTriageCalls(patientId));
  const outside = useEhr(() => listExternalNtpMeds(patientId, actor.role));
  return (
    <div className="space-y-4" data-testid="nursing-section">
      <Badge variant="outline">{NURSING_DRAFT_LABEL}</Badge>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-navy">Needs my action</h3>
        <NurseQueueList rows={rows} showPatient={false} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-navy">Clinic-administered orders</h3>
        {orders.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
        {orders.map((o) => (
          <Card key={o.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <span className="font-medium">{o.drugName}</span>
            <span className="text-muted-foreground">{[o.dose, o.route].filter(Boolean).join(" · ")}</span>
            <ClinicChainBadges orderId={o.id} orderedBy={(o as { signedBy?: string }).signedBy ?? o.createdBy} />
          </Card>
        ))}
      </section>
      {specimens.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-navy">Specimens collected</h3>
          {specimens.map((s) => (
            <p key={s.id} className="text-sm">{specimenLabel(s)} · {s.by}</p>
          ))}
        </section>
      )}
      {calls.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-navy">Triage calls</h3>
          {calls.map((c) => (
            <p key={c.id} className="text-sm">{TRIAGE_DISPOSITION_LABEL[c.disposition]} · {c.by}</p>
          ))}
        </section>
      )}
      {outside.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-navy">Outside NTP medication (reconciliation only — not an order)</h3>
          {outside.map((e) => (
            <p key={e.id} className="text-sm">{e.ntpName}: {e.dailyDose} daily · recorded by {e.recordedBy}</p>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- forms
export function ClinicMedOrderForm({ patientId, onDone }: { patientId: string; onDone: Done }) {
  const actor = useActor();
  const [drugName, setDrug] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("IM");
  const submit = () => {
    try {
      act("clinic_med_order", "orderClinicMedication", { patientId, drugName, dose, route, actor });
      onDone("Clinic medication ordered — sent for nurse review", "nursing");
    } catch (e) {
      fail(e);
    }
  };
  return (
    <div className="space-y-3" data-testid="clinic-med-form">
      <Badge variant="outline">{NURSING_DRAFT_LABEL}</Badge>
      <div className="space-y-1"><Label htmlFor="cm-drug">Medication</Label><Input id="cm-drug" value={drugName} onChange={(e) => setDrug(e.target.value)} placeholder="e.g. Naltrexone ER 380 mg injection" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="cm-dose">Dose</Label><Input id="cm-dose" value={dose} onChange={(e) => setDose(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="cm-route">Route</Label>
          <select id="cm-route" className={selectCls} value={route} onChange={(e) => setRoute(e.target.value)}>
            {["IM", "SubQ", "PO", "SL"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <Button onClick={submit}>Sign order</Button>
    </div>
  );
}

export function SpecimenForm({ patientId, onDone }: { patientId: string; onDone: Done }) {
  const actor = useActor();
  const labs = useEhr(() => listLabOrders(patientId, actor.role).filter((l) => l.status === "pending"));
  const [labId, setLab] = useState("");
  const [type, setType] = useState("Blood");
  const submit = () => {
    try {
      act("specimen_collect", "collectSpecimen", { patientId, labOrderId: labId || labs[0]?.id, specimenType: type, actor });
      onDone("Specimen collected", "nursing");
    } catch (e) {
      fail(e);
    }
  };
  if (!labs.length) return <p className="text-sm text-muted-foreground">No open lab orders to collect for.</p>;
  return (
    <div className="space-y-3" data-testid="specimen-form">
      <div className="space-y-1"><Label htmlFor="sp-lab">Lab order</Label>
        <select id="sp-lab" className={selectCls} value={labId} onChange={(e) => setLab(e.target.value)}>
          {labs.map((l) => <option key={l.id} value={l.id}>{labTest(l.testId)?.label ?? l.testId}</option>)}
        </select>
      </div>
      <div className="space-y-1"><Label htmlFor="sp-type">Specimen</Label>
        <select id="sp-type" className={selectCls} value={type} onChange={(e) => setType(e.target.value)}>
          {["Blood", "Urine", "Saliva"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <Button onClick={submit}>Record collection</Button>
    </div>
  );
}

export function TriageForm({ patientId, onDone }: { patientId: string; onDone: Done }) {
  const actor = useActor();
  const [concern, setConcern] = useState("");
  const [disposition, setDisp] = useState<TriageDisposition>("self_care");
  const submit = () => {
    try {
      act("triage_call", "recordTriageCall", { patientId, concern, disposition, actor });
      onDone("Triage call recorded", "nursing");
    } catch (e) {
      fail(e);
    }
  };
  return (
    <div className="space-y-3" data-testid="triage-form">
      <Badge variant="outline">{NURSING_DRAFT_LABEL}</Badge>
      <p className="text-xs text-muted-foreground">If the caller is in danger, connect them to 988 first.</p>
      <div className="space-y-1"><Label htmlFor="tr-concern">Concern</Label><Textarea id="tr-concern" value={concern} onChange={(e) => setConcern(e.target.value)} maxLength={300} /></div>
      <div className="space-y-1"><Label htmlFor="tr-disp">Outcome</Label>
        <select id="tr-disp" className={selectCls} value={disposition} onChange={(e) => setDisp(e.target.value as TriageDisposition)}>
          {Object.entries(TRIAGE_DISPOSITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Button onClick={submit}>Save</Button>
    </div>
  );
}

export function NtpReferralForm({ patientId, onDone }: { patientId: string; onDone: Done }) {
  const actor = useActor();
  const [reason, setReason] = useState("Opioid use disorder — methadone treatment requires a certified NTP.");
  const submit = () => {
    try {
      act("ntp_referral", "referToNtp", { patientId, reason, partnerOrgId: DEMO_NTP_ID, actor });
      onDone("NTP referral drafted and care plan goal added", "episodes");
    } catch (e) {
      fail(e);
    }
  };
  return (
    <div className="space-y-3" data-testid="ntp-referral-form">
      <Badge variant="outline">{METHADONE_GUARD_DRAFT}</Badge>
      <p className="text-sm">To: {partnerOrg(DEMO_NTP_ID)?.name}</p>
      <p className="text-xs text-muted-foreground">Sending it needs the person's Part 2 consent for this program. Medication treatment is never conditional on counseling or group attendance.</p>
      <div className="space-y-1"><Label htmlFor="ntp-reason">Reason</Label><Textarea id="ntp-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <Button onClick={submit}>Create referral</Button>
    </div>
  );
}

export function ExternalNtpForm({ patientId, onDone }: { patientId: string; onDone: Done }) {
  const actor = useActor();
  const [ntpName, setName] = useState(partnerOrg(DEMO_NTP_ID)?.name ?? "");
  const [dailyDose, setDose] = useState("");
  const submit = () => {
    try {
      act("ntp_external_med", "recordExternalNtpMedication", { patientId, ntpName, dailyDose, actor });
      onDone("Outside NTP medication recorded (reconciliation only)", "nursing");
    } catch (e) {
      fail(e);
    }
  };
  return (
    <div className="space-y-3" data-testid="external-ntp-form">
      <Badge variant="outline">Reconciliation only — not an order</Badge>
      <div className="space-y-1"><Label htmlFor="xn-name">NTP</Label><Input id="xn-name" value={ntpName} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="xn-dose">Daily dose reported by the NTP</Label><Input id="xn-dose" value={dailyDose} onChange={(e) => setDose(e.target.value)} /></div>
      <Button onClick={submit}>Record</Button>
    </div>
  );
}

/** Supervisors an LVN may name (for display). */
export const lvnSupervisors = () => STAFF_ROSTER.filter((s) => LVN_SUPERVISOR_ROLES.includes(s.role));
export const nursingSectionVisible = (role: string, patientId: string) =>
  ["nurse_rn", "lvn", "physician", "pmhnp"].includes(role) && !!AdelanteEHR.getPatient(patientId) && canDoChartAction("metabolic", { role: role as never });
