// §Turn 6 — "+ New" for billing, claims coordinator and sys_admin. Built only
// from CHART_ACTIONS entries marked `opsMenu`; every action runs through
// runAction (act / actResult). Roadmap items show disabled with their label.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, CLAIM_TRANSITIONS, claimMoveNeedsReason, PAYMENT_METHOD_LABEL, useEhrExt, type Claim, type ClaimState, type PaymentMethod } from "@/lib/ehr-ext";
import { PAYER_PROGRAMS, PAYMENT_ARRANGEMENTS, type PaymentArrangement } from "@/lib/rates";
import { BLOCKED_DOCS } from "@/lib/billingWorkspace";
import { CHART_ACTIONS, type ChartAction } from "@/lib/chartActions";
import { act, actFor, actResult, currentRunActor } from "@/lib/actions/act";
import { runAction } from "@/lib/actions/runAction";
import { useActingStaff } from "@/lib/roles";
import { billingWorkspace, adminToday, claimBlockLabel } from "@/lib/billingWorkspace";
import { featureSnapshot, REQUIRES_LIVE_VENDOR, type FeatureId } from "@/lib/features";
import { listMerges } from "@/lib/patientMerge";
import { searchPatients } from "@/lib/patientSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const OPS_EVENT = "adelante:ops-action";
/** Tiles open a "+ New" drawer by id (e.g. Fix a claim for one claim). */
export function openOpsAction(actionId: string, claimId?: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPS_EVENT, { detail: { actionId, claimId } }));
}

const FIX_LABEL: Record<string, string> = { claim_correct: "Fix a claim", claim_status: "Move claim status / resubmit", eligibility_check: "Run eligibility check", note_template_create: "Note template (create)", note_template_clone: "Note template (clone)", scheduling_rule_save: "Scheduling rule" };
const label = (a: ChartAction) => FIX_LABEL[a.id] ?? a.label.en;

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const el = document.createElement("a");
  el.href = url;
  el.download = name;
  el.click();
  URL.revokeObjectURL(url);
}

export function OpsActionLauncher() {
  const actor = useActingStaff();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<ChartAction | null>(null);
  const [claimId, setClaimId] = useState("");
  const items = useMemo(() => CHART_ACTIONS.filter((a) => a.opsMenu && a.allowed(actor, undefined).state !== "hidden"), [actor]);
  useEhr(() => AdelanteEHR.listAuditEvents({ category: "action", limit: 1 }));
  // Tiles can open a drawer directly.
  useEffect(() => {
    const l = (e: Event) => {
      const d = (e as CustomEvent<{ actionId: string; claimId?: string }>).detail;
      const a = items.find((x) => x.id === d.actionId && !x.pending);
      if (a) { setClaimId(d.claimId ?? ""); setSelected(a); }
    };
    window.addEventListener(OPS_EVENT, l);
    return () => window.removeEventListener(OPS_EVENT, l);
  }, [items]);
  if (!items.length) return null;

  const start = (a: ChartAction) => {
    setMenuOpen(false);
    if (a.pending) return;
    if (a.id === "open_permissions" || a.id === "review_matching") {
      const r = runAction(a.id, currentRunActor(), undefined);
      if (!r.ok) return toast.error(r.reason);
      navigate({ to: a.id === "open_permissions" ? "/admin-permissions" : "/data-exchange" });
      return;
    }
    if (a.id.startsWith("note_template")) return navigate({ to: "/admin-note-templates" });
    if (a.id === "scheduling_rule_save") return navigate({ to: "/admin-scheduling-rules" });
    setClaimId("");
    setSelected(a);
  };
  const close = () => setSelected(null);
  const groups: [string, ChartAction[]][] = [
    ["Billing & claims", items.filter((a) => a.group === "billing" && !a.pending)],
    ["Administration", items.filter((a) => a.group === "admin" && !a.pending)],
    ["Not available yet", items.filter((a) => a.pending)],
  ];

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button data-testid="ops-new-button" className="fixed bottom-24 right-4 z-50 h-12 rounded-full px-5 shadow-lg sm:right-6"><Plus className="h-5 w-5" /> New</Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="max-h-[70vh] w-80 overflow-y-auto p-2" data-testid="ops-add-menu">
          {groups.filter(([, l]) => l.length).map(([title, list]) => (
            <div key={title} className="mb-2">
              <p className="px-2 text-[10px] font-medium uppercase text-muted-foreground">{title}</p>
              {list.map((a) => (
                <Button key={a.id} variant="ghost" disabled={a.pending} data-testid={`ops-item-${a.id}`} className="h-auto w-full flex-col items-start justify-start py-2 text-left" onClick={() => start(a)}>
                  <span>{label(a)}</span>
                  {a.comingSoon && <span className="text-[11px] text-muted-foreground">{a.comingSoon}</span>}
                </Button>
              ))}
            </div>
          ))}
        </PopoverContent>
      </Popover>
      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) close(); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="ops-action-drawer">
          {selected && (
            <div className="space-y-4">
              <div>
                <SheetTitle>{label(selected)}</SheetTitle>
                <SheetDescription>Recorded in the audit log as you.</SheetDescription>
              </div>
              <OpsBody action={selected} claimId={claimId} setClaimId={setClaimId} done={close} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function OpsBody({ action, claimId, setClaimId, done }: { action: ChartAction; claimId: string; setClaimId: (id: string) => void; done: () => void }) {
  const { role } = useActingStaff();
  const claims = useEhrExt(() => AdelanteEHRExt.listClaims());
  const ws = billingWorkspace(role, claims);
  const claim = claims.find((c) => c.id === claimId);
  const pick = (list: Claim[], hint: string): ReactNode => <ClaimPicker claims={list} hint={hint} blocked={ws.blocked} choose={setClaimId} />;
  switch (action.id) {
    case "claim_correct": {
      const fixable = [...ws.blocked.map((b) => b.claim), ...claims.filter((c) => !ws.blocked.some((b) => b.claim.id === c.id) && ["documented", "signed", "coded", "generated", "denied"].includes(c.state))];
      return claim ? <CorrectForm claim={claim} done={done} /> : pick(fixable, "Blocked claims first.");
    }
    case "claim_status":
      return claim ? <StatusForm claim={claim} done={done} /> : pick(claims.filter((c) => CLAIM_TRANSITIONS[c.state].length), "Pick a claim to move or resubmit.");
    case "payment_record":
      return claim ? <PaymentForm claim={claim} done={done} /> : pick(ws.paymentsToPost, "Claims with a patient balance.");
    case "claim_duplicate_review":
      return claim ? <HoldForm claim={claim} done={done} /> : pick(ws.holds, "Claims held after a record merge.");
    case "eligibility_check": return <PatientPick render={(pid) => <EligibilityRun patientId={pid} />} />;
    case "payment_arrangement": return <PatientPick render={(pid) => <ArrangementForm patientId={pid} done={done} />} />;
    case "claims_export": return <ExportPanel />;
    case "isl_export": return <ExportPanel />;
    case "notification_resend": return <ResendPanel />;
    case "feature_flag_set": return <FlagPanel />;
    case "reconfirm_consent_merged": return <ReconfirmPanel />;
    default: return null;
  }
}

function ClaimPicker({ claims, hint, blocked, choose }: { claims: Claim[]; hint: string; blocked: { claim: Claim; reason: string }[]; choose: (id: string) => void }) {
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const [q, setQ] = useState("");
  const rows = claims.filter((c) => {
    const p = patients.find((x) => x.id === c.patientId);
    return !q.trim() || `${c.id} ${p?.firstName} ${p?.lastName} ${p?.programId}`.toLowerCase().includes(q.toLowerCase());
  });
  return (
    <div className="space-y-2" data-testid="ops-claim-picker">
      <Label htmlFor="ops-claim-search">Claim</Label>
      <Input id="ops-claim-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient, program ID or claim" />
      <p className="text-xs text-muted-foreground">{hint}</p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No claims here.</p> : (
        <div className="divide-y rounded-md border">
          {rows.slice(0, 25).map((c) => {
            const p = patients.find((x) => x.id === c.patientId);
            const why = blocked.find((b) => b.claim.id === c.id)?.reason ?? (c.duplicateReview ? "Held: possible duplicate after merge" : undefined);
            return (
              <Button key={c.id} variant="ghost" className="h-auto w-full justify-start rounded-none py-2 text-left" onClick={() => choose(c.id)}>
                <span>
                  <span className="block font-medium">{p ? `${p.firstName} ${p.lastName}` : c.patientId} · {c.serviceDate ?? ""}</span>
                  <span className="block text-xs text-muted-foreground">{c.serviceCode ?? "—"} · {c.state}{why ? ` · ${why}` : ""}</span>
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PatientPick({ render }: { render: (patientId: string) => ReactNode }) {
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const [q, setQ] = useState("");
  const [pid, setPid] = useState("");
  const p = patients.find((x) => x.id === pid);
  if (p) return <div className="space-y-3"><p className="text-sm">{p.firstName} {p.lastName} · {p.programId} <Button size="sm" variant="ghost" onClick={() => setPid("")}>Change</Button></p>{render(p.id)}</div>;
  const rows = q.trim().length >= 2 ? searchPatients(patients, q, undefined, 10).map((r) => r.patient) : patients.slice(0, 10);
  return (
    <div className="space-y-2" data-testid="ops-patient-picker">
      <Label htmlFor="ops-patient-search">Patient</Label>
      <Input id="ops-patient-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, DOB or program ID" />
      <div className="divide-y rounded-md border">
        {rows.map((x) => <Button key={x.id} variant="ghost" className="h-auto w-full justify-start rounded-none py-2 text-left" onClick={() => setPid(x.id)}><span><span className="block font-medium">{x.firstName} {x.lastName}</span><span className="block text-xs text-muted-foreground">DOB {x.dob} · {x.programId}</span></span></Button>)}
      </div>
    </div>
  );
}

function result(r: { ok: boolean; error?: string } | unknown, msg: string, done?: () => void) {
  const v = r as { ok?: boolean; error?: string };
  if (v && v.ok === false) { toast.error(v.error ?? "Couldn't complete that."); return; }
  toast.success(msg);
  done?.();
}

function CorrectForm({ claim, done }: { claim: Claim; done: () => void }) {
  const { role } = useActingStaff();
  const [code, setCode] = useState(claim.serviceCode ?? "");
  const [units, setUnits] = useState(String(claim.units ?? 1));
  const [reason, setReason] = useState("");
  const [program, setProgram] = useState<string>(claim.program ?? "");
  const docsBlocked = claimBlockLabel(claim, role) === BLOCKED_DOCS;
  return (
    <div className="space-y-3" data-testid="ops-correct-form">
      {docsBlocked && <p className="rounded-md border p-2 text-sm" data-testid="ops-docs-blocked">{BLOCKED_DOCS}. The clinician must finish the note; billing can't clear this.</p>}
      <Label>Payer program</Label>
      <Select value={program} onValueChange={setProgram}><SelectTrigger aria-label="Payer program"><SelectValue placeholder="Choose program" /></SelectTrigger><SelectContent>{PAYER_PROGRAMS.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select>
      <Label htmlFor="ops-code">Service code</Label>
      <Input id="ops-code" value={code} onChange={(e) => setCode(e.target.value)} />
      <Label htmlFor="ops-units">Units</Label>
      <Input id="ops-units" type="number" min={1} value={units} onChange={(e) => setUnits(e.target.value)} />
      <Label htmlFor="ops-reason">Reason (required)</Label>
      <Input id="ops-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What was wrong" />
      <Button disabled={!reason.trim()} onClick={() => result(actResult("claim_correct", "correctClaim", claim.patientId, claim.id, { serviceCode: code, units: Number(units), ...(program && program !== claim.program ? { program } : {}) }, reason), "Claim corrected", done)}>Save correction</Button>
    </div>
  );
}

function StatusForm({ claim, done }: { claim: Claim; done: () => void }) {
  const next = CLAIM_TRANSITIONS[claim.state];
  const [to, setTo] = useState<ClaimState>(next[0]!);
  const [reason, setReason] = useState("");
  const needs = claimMoveNeedsReason(claim.state, to);
  return (
    <div className="space-y-3" data-testid="ops-status-form">
      <p className="text-sm">Now: <Badge variant="outline">{claim.state}</Badge></p>
      <Label>Move to</Label>
      <Select value={to} onValueChange={(v) => setTo(v as ClaimState)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{next.map((s) => <SelectItem key={s} value={s}>{s === "generated" && claim.state === "denied" ? "resubmit (ready)" : s}</SelectItem>)}</SelectContent></Select>
      {needs && <><Label htmlFor="ops-move-reason">Reason (required)</Label><Input id="ops-move-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></>}
      <Button disabled={needs && !reason.trim()} onClick={() => result(actResult("claim_status", "transitionClaim", claim.patientId, claim.id, to, to === "denied" ? { denialReason: reason } : { note: reason || undefined }), "Simulated — claim status updated (no clearinghouse connected)", done)}>Move claim</Button>
    </div>
  );
}

function PaymentForm({ claim, done }: { claim: Claim; done: () => void }) {
  const [amount, setAmount] = useState(((claim.patientBalanceCents ?? 0) / 100).toFixed(2));
  const [on, setOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [ref, setRef] = useState("");
  return (
    <div className="space-y-3">
      <Label htmlFor="ops-amt">Amount ($)</Label><Input id="ops-amt" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Label htmlFor="ops-on">Received on</Label><Input id="ops-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
      <Label>Method</Label>
      <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
      <Label htmlFor="ops-ref">Receipt / check number</Label><Input id="ops-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
      <Button onClick={() => result(actResult("payment_record", "recordPatientPayment", claim.patientId, { claimId: claim.id, amountCents: Math.round(Number(amount) * 100), receivedOn: on, method, reference: ref }), "Simulated — payment recorded (no payment processor connected)", done)}>Record payment</Button>
    </div>
  );
}

function HoldForm({ claim, done }: { claim: Claim; done: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm">Held: possible duplicate after a record merge (other claim {claim.duplicateReview?.otherClaimId}).</p>
      <Label htmlFor="ops-hold-note">Review note (required)</Label><Input id="ops-hold-note" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button disabled={!note.trim()} onClick={() => result(actResult("claim_duplicate_review", "clearDuplicateClaimReview", claim.patientId, claim.id, note), "Hold cleared", done)}>Clear hold</Button>
    </div>
  );
}

function EligibilityRun({ patientId }: { patientId: string }) {
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2">
      <Button data-testid="ops-run-eligibility" onClick={() => {
        const r = runAction<{ detail: string }>("eligibility_check", currentRunActor(), AdelanteEHR.getPatient(patientId), { args: [patientId] });
        if (!r.ok) return toast.error(r.reason);
        const text = `Simulated check — ${r.value.detail}`;
        setMsg(text);
        toast.success(text);
      }}>Run check</Button>
      {msg && <p className="rounded-md border p-2 text-sm" data-testid="ops-eligibility-result">{msg}</p>}
    </div>
  );
}

function ArrangementForm({ patientId, done }: { patientId: string; done: () => void }) {
  const [a, setA] = useState<PaymentArrangement>("self_pay");
  return (
    <div className="space-y-3">
      <Select value={a} onValueChange={(v) => setA(v as PaymentArrangement)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_ARRANGEMENTS.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select>
      <Button onClick={() => result(actResult("payment_arrangement", "setPaymentArrangement", patientId, patientId, a), "Simulated — payment arrangement saved", done)}>Save arrangement</Button>
    </div>
  );
}

function ExportPanel() {
  const day = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => { try { download(`isl-${day}.csv`, actFor<string>("isl_export", "exportIslReport", undefined)); toast.success("Simulated — ISL file downloaded (not submitted)"); } catch (e) { toast.error((e as Error).message); } }}>ISL export (CSV)</Button>
      <Button variant="outline" onClick={() => { try { download(`claims-${day}.csv`, actFor<string>("claims_export", "exportClaimsCsv", undefined)); toast.success("Claims file downloaded"); } catch (e) { toast.error((e as Error).message); } }}>Claims export (CSV)</Button>
    </div>
  );
}

function ResendPanel() {
  const today = useEhr(() => adminToday());
  if (!today.failedNotifications.length) return <p className="text-sm text-muted-foreground">No failed notifications.</p>;
  return (
    <ul className="divide-y rounded-md border text-sm">
      {today.failedNotifications.map((n) => (
        <li key={n.notificationId} className="flex items-center justify-between p-2">
          <span><span className="font-mono text-xs">{n.programId}</span> · {n.channel} · {n.kind}</span>
          <Button size="sm" variant="outline" onClick={() => { try { actFor("notification_resend", "resendNotification", n.patientId, n.patientId, n.notificationId); toast.success("Simulated — delivery retried"); } catch (e) { toast.error((e as Error).message); } }}>Resend</Button>
        </li>
      ))}
    </ul>
  );
}

function FlagPanel() {
  const { staffName } = useActingStaff() as { staffName?: string };
  useEhr(() => AdelanteEHR.listAuditEvents({ category: "action", limit: 1 }));
  const flags = featureSnapshot();
  const [id, setId] = useState<FeatureId>("in_facility");
  const [reason, setReason] = useState("");
  const cur = flags.find((f) => f.id === id)!;
  const run = (mode: "on" | "off" | "live") => {
    try {
      act("feature_flag_set", "setFeatureFlagWithReason", id, mode, reason, staffName);
      toast.success(`${id} turned ${mode === "off" ? "off" : "on"}`);
      setReason("");
    } catch (e) {
      toast.error(`${(e as Error).message} This attempt was recorded.`);
    }
  };
  return (
    <div className="space-y-3" data-testid="ops-flag-panel">
      <Label>Feature flag</Label>
      <Select value={id} onValueChange={(v) => setId(v as FeatureId)}><SelectTrigger aria-label="Feature flag"><SelectValue /></SelectTrigger><SelectContent>{flags.map((f) => <SelectItem key={f.id} value={f.id}>{f.id}{f.flag.simulated ? " (Simulated)" : ""}</SelectItem>)}</SelectContent></Select>
      <p className="text-xs text-muted-foreground">{cur.flag.description} Currently <strong>{cur.value ? "on" : "off"}</strong>.</p>
      <Label htmlFor="ops-flag-reason">Reason (required)</Label>
      <Input id="ops-flag-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      {cur.flag.simulated ? (
        <div className="space-y-1">
          <Button variant="outline" data-testid="ops-flag-live" onClick={() => run("live")}>Make live</Button>
          <p className="text-xs text-muted-foreground">Simulated — {REQUIRES_LIVE_VENDOR}.</p>
        </div>
      ) : (
        <Button data-testid="ops-flag-toggle" disabled={!reason.trim()} onClick={() => run(cur.value ? "off" : "on")}>Turn {cur.value ? "off" : "on"}</Button>
      )}
    </div>
  );
}

function ReconfirmPanel() {
  const merges = useEhr(() => listMerges().filter((m) => m.status === "active"));
  const patients = useEhr(() => AdelanteEHR.listPatients());
  if (!merges.length) return <p className="text-sm text-muted-foreground">No merged records need consent review.</p>;
  return (
    <ul className="divide-y rounded-md border text-sm">
      {merges.map((m) => {
        const p = patients.find((x) => x.id === m.survivorId);
        return (
          <li key={m.id} className="flex items-center justify-between p-2">
            <span>{p ? `${p.firstName} ${p.lastName}` : m.survivorId}</span>
            <Link to="/record/$patientId" params={{ patientId: m.survivorId }} search={{ section: "consents" } as never} className="text-teal underline">Open consents</Link>
          </li>
        );
      })}
    </ul>
  );
}
