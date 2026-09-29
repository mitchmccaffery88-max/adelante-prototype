// §Chart redesign turn 2 — lab orders, screener requests and metabolic
// measures: the three drawer forms and their Tracking panel. Every write goes
// through src/lib/chartOrders.ts (role-checked, audited, Part 2-filtered).
import { act, actFor } from "@/lib/actions/act";
import { useState } from "react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff, type StaffRole } from "@/lib/roles";
import {
  LAB_PLACEHOLDER_LABEL,
  METABOLIC_DRAFT_LABEL,
  canOrderLabs,
  canRecordMetabolic,
  computeBmi,
  enterLabResult,
  labTest,
  listLabOrders,
  listMetabolic,
  listScreenerRequests,
  metabolicFlags,
  orderableLabs,
  placeLabOrder,
  recordMetabolic,
  requestScreener,
  requestableScreeners,
  screenerRequestStatus,
  REQUESTABLE_SCREENERS,
  type LabFlag,
  type LabPriority,
} from "@/lib/chartOrders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FormDone = (message: string, sectionId: string) => void;

const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function useActor() {
  const { role, staffName } = useActingStaff();
  return { role, actor: { name: staffName, role } };
}

// ---------------------------------------------------------------- forms
export function LabOrderForm({ patientId, onDone }: { patientId: string; onDone: FormDone }) {
  const { role, actor } = useActor();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const tests = orderableLabs(role, patient);
  const [testId, setTestId] = useState(tests[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<LabPriority>("routine");
  const [due, setDue] = useState(isoDay(7));
  if (!tests.length) return <p className="text-sm text-muted-foreground">No lab orders for your role.</p>;
  const submit = () => {
    try {
      const o = act<ReturnType<typeof placeLabOrder>>("lab_order", "placeLabOrder", { patientId, testId, reason, priority, dueAt: new Date(due).toISOString(), actor });
      onDone(`${labTest(o.testId)?.label} ordered (placeholder — not sent)`, "tracking");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-3" data-testid="lab-order-form">
      <Badge variant="outline" className="text-xs">{LAB_PLACEHOLDER_LABEL}</Badge>
      <div className="space-y-1">
        <Label htmlFor="lab-test">Test</Label>
        <select id="lab-test" className={selectCls} value={testId} onChange={(e) => setTestId(e.target.value)}>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="lab-reason">Reason</Label>
        <Input id="lab-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Lithium trough level" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="lab-priority">Priority</Label>
          <select id="lab-priority" className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value as LabPriority)}>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="lab-due">Due date</Label>
          <Input id="lab-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      <Button onClick={submit}>Place order</Button>
    </div>
  );
}

export function ScreenerRequestForm({ patientId, onDone }: { patientId: string; onDone: FormDone }) {
  const { role, actor } = useActor();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const options = requestableScreeners(role, patient);
  const [key, setKey] = useState(options[0]?.key ?? "");
  const [due, setDue] = useState(isoDay(7));
  if (!options.length) return <p className="text-sm text-muted-foreground">No questionnaires to request.</p>;
  const submit = () => {
    try {
      act("screener_request", "requestScreener", { patientId, key, dueAt: new Date(`${due}T23:59:00`).toISOString(), actor });
      onDone(`${options.find((o) => o.key === key)?.label} requested — it's on the patient's home screen`, "tracking");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-3" data-testid="screener-request-form">
      <div className="space-y-1">
        <Label htmlFor="scr-key">Questionnaire</Label>
        <select id="scr-key" className={selectCls} value={key} onChange={(e) => setKey(e.target.value)}>
          {options.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="scr-due">Due by</Label>
        <Input id="scr-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">
        The patient sees “Your care team asked you to fill this out” on their home screen.
      </p>
      <Button onClick={submit}>Send request</Button>
    </div>
  );
}

export function MetabolicForm({ patientId, onDone }: { patientId: string; onDone: FormDone }) {
  const { actor } = useActor();
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [wt, setWt] = useState("");
  const [ht, setHt] = useState("");
  const bmi = Number(wt) > 0 && Number(ht) > 0 ? computeBmi(Number(wt), Number(ht)) : undefined;
  const submit = () => {
    try {
      act("metabolic", "recordMetabolic", { patientId, bpSystolic: Number(sys), bpDiastolic: Number(dia), weightKg: Number(wt), heightCm: Number(ht), actor });
      onDone("Metabolic measures saved", "tracking");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-3" data-testid="metabolic-form">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="m-sys">BP systolic</Label><Input id="m-sys" inputMode="numeric" value={sys} onChange={(e) => setSys(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="m-dia">BP diastolic</Label><Input id="m-dia" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="m-wt">Weight (kg)</Label><Input id="m-wt" inputMode="decimal" value={wt} onChange={(e) => setWt(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="m-ht">Height (cm)</Label><Input id="m-ht" inputMode="decimal" value={ht} onChange={(e) => setHt(e.target.value)} /></div>
      </div>
      <p className="text-sm">BMI: <span className="font-medium">{bmi ?? "—"}</span></p>
      <p className="text-xs text-muted-foreground">{METABOLIC_DRAFT_LABEL}</p>
      <Button onClick={submit}>Save measures</Button>
    </div>
  );
}

// ---------------------------------------------------------------- tracking panel
function ResultEntry({ orderId, unit }: { orderId: string; unit: string }) {
  const { actor } = useActor();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [u, setU] = useState(unit);
  const [flag, setFlag] = useState<LabFlag>("normal");
  const [date, setDate] = useState(isoDay());
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Enter result</Button>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input aria-label="Result value" className="h-8 w-24" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
      <Input aria-label="Unit" className="h-8 w-24" value={u} onChange={(e) => setU(e.target.value)} placeholder="Unit" />
      <select aria-label="Flag" className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={flag} onChange={(e) => setFlag(e.target.value as LabFlag)}>
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="low">Low</option>
      </select>
      <Input aria-label="Result date" type="date" className="h-8 w-36" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button
        size="sm"
        onClick={() => {
          try {
            enterLabResult({ orderId, value, unit: u, flag, date, actor });
            toast.success("Result saved");
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      >
        Save
      </Button>
    </div>
  );
}

export function LabsAndMeasuresTracking({ patientId, role }: { patientId: string; role: StaffRole }) {
  const labsJson = useEhr(() => JSON.stringify(listLabOrders(patientId, role)));
  const reqJson = useEhr(() =>
    JSON.stringify(listScreenerRequests(patientId, role).map((r) => ({ ...r, status: screenerRequestStatus(r) }))),
  );
  const metJson = useEhr(() => JSON.stringify(listMetabolic(patientId)));
  const labs = JSON.parse(labsJson) as ReturnType<typeof listLabOrders>;
  const reqs = JSON.parse(reqJson) as (ReturnType<typeof listScreenerRequests>[number] & { status: string })[];
  const met = JSON.parse(metJson) as ReturnType<typeof listMetabolic>;
  const canResult = canOrderLabs(role);
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3 space-y-2" data-testid="tracking-labs">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="flex-1 text-sm font-medium text-navy">Labs</h4>
          <Badge variant="outline" className="text-[10px]">{LAB_PLACEHOLDER_LABEL}</Badge>
        </div>
        {labs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No lab orders.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {labs.map((o) => (
              <li key={o.id} className="rounded border bg-card p-2 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{labTest(o.testId)?.label}</span>
                  <Badge variant={o.status === "pending" ? "secondary" : "outline"} className="text-[10px]">
                    {o.status === "pending" ? "Result pending" : "Resulted"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {o.priority} · due {new Date(o.dueAt).toLocaleDateString()} · {o.orderedBy}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Reason: {o.reason}</p>
                {o.result ? (
                  <p className="text-xs">
                    {o.result.value} {o.result.unit} ·{" "}
                    <span className={o.result.flag === "normal" ? "" : "font-semibold text-destructive"}>{o.result.flag}</span> ·{" "}
                    {new Date(o.result.date).toLocaleDateString()}
                  </p>
                ) : canResult ? (
                  <ResultEntry orderId={o.id} unit={labTest(o.testId)?.unit ?? ""} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {reqs.length > 0 && (
        <div className="rounded-md border p-3 space-y-2" data-testid="tracking-screener-requests">
          <h4 className="text-sm font-medium text-navy">Requested questionnaires</h4>
          <ul className="space-y-1 text-xs">
            {reqs.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2">
                <span className="font-medium">{REQUESTABLE_SCREENERS.find((s) => s.key === r.key)?.label ?? r.key}</span>
                <Badge variant={r.status === "overdue" ? "destructive" : "secondary"} className="text-[10px]">
                  {r.status === "completed" ? "Completed" : r.status === "overdue" ? "Missed" : "Waiting on patient"}
                </Badge>
                <span className="text-muted-foreground">
                  asked by {r.requestedBy} · due {new Date(r.dueAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(met.length > 0 || canRecordMetabolic(role)) && (
        <div className="rounded-md border p-3 space-y-2" data-testid="tracking-metabolic">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="flex-1 text-sm font-medium text-navy">Metabolic measures</h4>
            <span className="text-[10px] text-muted-foreground">{METABOLIC_DRAFT_LABEL}</span>
          </div>
          {met.length === 0 ? (
            <p className="text-xs text-muted-foreground">No measures yet.</p>
          ) : (
            <>
              <ul className="space-y-1 text-xs">
                {[...met].reverse().map((m) => {
                  const f = metabolicFlags(m);
                  return (
                    <li key={m.id} className="flex flex-wrap gap-2">
                      <span>{new Date(m.at).toLocaleDateString()}</span>
                      <span className={f.bp === "high" ? "font-semibold text-destructive" : ""}>BP {m.bpSystolic}/{m.bpDiastolic}</span>
                      <span>{m.weightKg} kg · {m.heightCm} cm</span>
                      <span className={f.bmi !== "normal" ? "font-semibold text-destructive" : ""}>BMI {m.bmi}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={met.map((m) => ({ date: new Date(m.at).toLocaleDateString(), bmi: m.bmi, systolic: m.bpSystolic }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <RTooltip />
                    <Line type="monotone" dataKey="bmi" stroke="var(--navy)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="systolic" stroke="var(--teal)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
