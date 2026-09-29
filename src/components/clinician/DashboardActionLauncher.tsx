import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { CHART_ACTIONS, type ChartAction, type ChartActionAnswer } from "@/lib/chartActions";
import { DASHBOARD_ACTION_EVENT, type DashboardActionDetail } from "@/lib/dashboardActionBus";
import { STAFF_ROSTER, useActingStaff } from "@/lib/roles";
import { assignmentIdentityFor, isAssignedTo } from "@/lib/caseloadScope";
import { searchPatients } from "@/lib/patientSearch";
import { isTypingTarget, CHART_SHORTCUTS } from "@/components/chart/ChartActionLauncher";
import { NoteDraftPanel, OutreachDraftPanel, RefillDecisionPanel } from "@/components/chart/AdelDrafts";
import { ContactLogForm } from "@/components/chart/DrawerForms";
import { LabOrderForm, MetabolicForm, ScreenerRequestForm } from "@/components/chart/LabsAndMeasures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const HIDDEN_ROLES = ["billing", "billing_coordinator", "credentialing_coordinator", "sys_admin"];
type Available = { action: ChartAction; answer: ChartActionAnswer };

export function DashboardActionLauncher({ onBook, onOpenChart, todayPatientIds = [] }: { onBook: (patientId?: string) => void; onOpenChart: (patientId: string, section?: string) => void; todayPatientIds?: string[] }) {
  const actor = useActingStaff();
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const [menuOpen, setMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [selected, setSelected] = useState<Available | null>(null);
  const [patientId, setPatientId] = useState("");
  const [query, setQuery] = useState("");
  const patient = patients.find((p) => p.id === patientId);
  const identity = assignmentIdentityFor(actor);
  const available = useMemo(() => CHART_ACTIONS.filter((a) => !a.pending).map((action) => ({ action, answer: action.allowed(actor, patient) })).filter((x) => x.answer.state !== "hidden"), [actor, patient]);
  const recent = patients.filter((p) => todayPatientIds.includes(p.id) || isAssignedTo(p, identity)).sort((a, b) => Number(todayPatientIds.includes(b.id)) - Number(todayPatientIds.includes(a.id))).slice(0, 8);
  const results = query.trim().length >= 2 ? searchPatients(patients, query, identity, 8).map((r) => r.patient) : recent;
  const hide = HIDDEN_ROLES.includes(actor.role);

  const open = (actionId: string, pid?: string) => {
    const p = pid ? patients.find((x) => x.id === pid) : patient;
    const action = CHART_ACTIONS.find((x) => x.id === actionId);
    if (!action || action.pending) return false;
    const answer = action.allowed(actor, p);
    if (answer.state === "hidden") return false;
    setPatientId(pid ?? "");
    setSelected({ action, answer });
    setMenuOpen(false);
    setCmdOpen(false);
    return true;
  };
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<DashboardActionDetail>).detail;
      if (!open(detail.actionId, detail.patientId)) toast.error("That action isn't available for your role.");
    };
    window.addEventListener(DASHBOARD_ACTION_EVENT, listener);
    return () => window.removeEventListener(DASHBOARD_ACTION_EVENT, listener);
  });
  useEffect(() => {
    if (hide) return;
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCmdOpen((v) => !v); return; }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target) || selected || cmdOpen) return;
      const actionId = CHART_SHORTCUTS[event.key.toLowerCase()];
      if (actionId && open(actionId)) event.preventDefault();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  if (hide) return null;

  const patientFree = available.filter((x) => x.action.needsPatient === false);
  const patientActions = available.filter((x) => x.action.needsPatient !== false && !["addendum", "cures", "demographics_edit", "discharge_episode"].includes(x.action.id));
  const needsPick = selected && selected.action.needsPatient !== false && !patient;
  const done = (message: string) => { toast.success(message); setSelected(null); };
  const body = (): ReactNode => {
    if (!selected) return null;
    if (needsPick) return <PatientStep patients={results} query={query} setQuery={setQuery} choose={setPatientId} />;
    switch (selected.action.id) {
      case "dashboard_book": return <BookStart onBook={onBook} done={() => setSelected(null)} />;
      case "dashboard_task": return <TaskForm done={() => done("Task created")} />;
      case "dashboard_contact": return patient ? <ContactLogForm patientId={patient.id} onDone={(m) => done(m)} /> : <PatientStep patients={results} query={query} setQuery={setQuery} choose={setPatientId} />;
      case "dashboard_referral": return patient ? <ReferralStart patientId={patient.id} onOpenChart={onOpenChart} /> : <PatientStep patients={results} query={query} setQuery={setQuery} choose={setPatientId} />;
      case "progress_note": return patient ? <NoteDraftPanel patientId={patient.id} /> : null;
      case "refill_decision": return patient ? <RefillDecisionPanel patientId={patient.id} /> : null;
      case "message_patient": return patient ? <OutreachDraftPanel patientId={patient.id} /> : null;
      case "lab_order": return patient ? <LabOrderForm patientId={patient.id} onDone={(m) => done(m)} /> : null;
      case "screener_request": return patient ? <ScreenerRequestForm patientId={patient.id} onDone={(m) => done(m)} /> : null;
      case "metabolic": return patient ? <MetabolicForm patientId={patient.id} onDone={(m) => done(m)} /> : null;
      default: return patient ? <Button onClick={() => { onOpenChart(patient.id, selected.action.sectionId); setSelected(null); }}>Open {selected.action.label.en.toLowerCase()} in chart</Button> : null;
    }
  };

  return <>
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild><Button data-testid="dashboard-new-button" className="fixed bottom-16 right-4 z-50 h-12 rounded-full px-5 shadow-lg sm:right-6"><Plus className="h-5 w-5" /> New</Button></PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 max-h-[70vh] overflow-y-auto p-2" data-testid="dashboard-add-menu">
        <button type="button" onClick={() => { setMenuOpen(false); setCmdOpen(true); }} className="mb-2 flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm"><Search className="h-4 w-4" /><span className="flex-1">Search or add anything…</span><kbd className="rounded border px-1 text-[10px]">⌘K</kbd></button>
        <p className="px-2 text-[10px] font-medium uppercase text-muted-foreground">Patient actions</p>
        {patientActions.map((x) => <Button key={x.action.id} variant="ghost" className="h-auto w-full justify-start py-2" onClick={() => open(x.action.id)}>{x.action.label.en}</Button>)}
        <p className="mt-2 px-2 text-[10px] font-medium uppercase text-muted-foreground">Without a patient selected</p>
        {patientFree.map((x) => <Button key={x.action.id} variant="ghost" className="h-auto w-full justify-start py-2" onClick={() => open(x.action.id)}>{x.action.label.en}</Button>)}
      </PopoverContent>
    </Popover>
    <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}><CommandInput placeholder="Search or add anything…" /><CommandList><CommandEmpty>No matches.</CommandEmpty><CommandGroup heading="Patient actions">{patientActions.map((x) => <CommandItem key={x.action.id} onSelect={() => open(x.action.id)}><Plus className="h-4 w-4" />{x.action.label.en}</CommandItem>)}</CommandGroup><CommandGroup heading="Without a patient selected">{patientFree.map((x) => <CommandItem key={x.action.id} onSelect={() => open(x.action.id)}><Plus className="h-4 w-4" />{x.action.label.en}</CommandItem>)}</CommandGroup></CommandList></CommandDialog>
    <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="dashboard-action-drawer">{selected && <div className="space-y-4"><div><SheetTitle>{selected.action.label.en}</SheetTitle><SheetDescription>{patient ? `${patient.firstName} ${patient.lastName}` : selected.action.needsPatient === false ? "No patient selected" : "Choose a patient first"}</SheetDescription></div>{body()}</div>}</SheetContent></Sheet>
  </>;
}

function PatientStep({ patients, query, setQuery, choose }: { patients: ReturnType<typeof AdelanteEHR.listPatients>; query: string; setQuery: (v: string) => void; choose: (id: string) => void }) {
  return <div className="space-y-3" data-testid="dashboard-patient-picker"><Label htmlFor="dashboard-patient-search">Patient</Label><Input id="dashboard-patient-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, DOB or program ID" /><p className="text-xs text-muted-foreground">Today’s schedule and recent patients appear first.</p><div className="divide-y rounded-md border">{patients.map((p) => <Button key={p.id} variant="ghost" className="h-auto w-full justify-start rounded-none py-2 text-left" onClick={() => choose(p.id)}><span><span className="block font-medium">{p.firstName} {p.lastName}</span><span className="block text-xs text-muted-foreground">DOB {p.dob} · {p.programId}</span></span></Button>)}</div></div>;
}

function TaskForm({ done }: { done: () => void }) {
  const actor = useActingStaff(); const [title, setTitle] = useState(""); const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10)); const [owner, setOwner] = useState(actor.staffId);
  const eligible = STAFF_OPTIONS(actor.role);
  return <div className="space-y-3" data-testid="dashboard-task-form"><Label>Task</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" /><Label>Owner</Label><Select value={owner} onValueChange={setOwner}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{eligible.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><Label>Due</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /><Button disabled={!title.trim() || !due} onClick={() => { AdelanteEHR.createCaseTask({ patientId: "", assignedTo: owner, title: title.trim(), dueDate: due, origin: "manual", source: "dashboard" }); done(); }}>Create task</Button></div>;
}
function STAFF_OPTIONS(role: string) { const all = STAFF_ROSTER.filter((s) => !["patient", "advocate", "billing", "billing_coordinator"].includes(s.role)).map((s) => ({ id: s.id, name: s.name })); return role === "clinical_coordinator" ? all : all; }
function BookStart({ onBook, done }: { onBook: (patientId?: string) => void; done: () => void }) { return <div className="space-y-3"><p className="text-sm text-muted-foreground">Open the compact booking form in Requests & booking.</p><Button onClick={() => { onBook(); done(); }}>Book a visit</Button></div>; }
function ReferralStart({ patientId, onOpenChart }: { patientId: string; onOpenChart: (id: string, section?: string) => void }) { return <div className="space-y-3"><p className="text-sm text-muted-foreground">Choose an identified need and a directory resource in the patient chart. Part 2 consent is checked before saving.</p><Button onClick={() => onOpenChart(patientId, "episodes")}>Open resource directory referral</Button></div>; }
