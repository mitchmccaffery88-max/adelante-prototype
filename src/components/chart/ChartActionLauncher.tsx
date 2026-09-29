// §Chart redesign turn 2 — floating "+ New" button, "Add to this chart" menu,
// command bar (Ctrl/Cmd+K) and single-key shortcuts. Built ENTIRELY from the
// chart action registry (src/lib/chartActions.ts): hidden actions never show,
// cosign actions show who they route to. Each action opens a side drawer
// (bottom sheet on phones) with the existing form or section, so the
// clinician never leaves the chart.
import { confirmationFor } from "@/lib/actions/runAction";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Keyboard, Plus, Search } from "lucide-react";
import { useActingStaff } from "@/lib/roles";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { recordBlockedAttempt } from "@/lib/actions/runAction";
import { CHART_ACTIONS, type ChartAction, type ChartActionAnswer, type ChartActionGroup } from "@/lib/chartActions";
import type { RecordSection } from "@/components/clinical/recordSections";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LabOrderForm, MetabolicForm, ScreenerRequestForm, type FormDone } from "@/components/chart/LabsAndMeasures";
import { ContactLogForm, DocumentUploadForm } from "@/components/chart/DrawerForms";
import { CHART_ACTION_EVENT } from "@/lib/chartActionBus";
import { NoteDraftPanel, OutreachDraftPanel, RefillDecisionPanel } from "@/components/chart/AdelDrafts";

const GROUPS: { id: ChartActionGroup; label: string }[] = [
  { id: "document", label: "Document" },
  { id: "clinical", label: "Clinical" },
  { id: "care", label: "Care" },
  { id: "coordination", label: "Coordination" },
];
/** Roles that never see the button (no chart actions by design). */
const NO_BUTTON_ROLES = ["billing", "billing_coordinator"];
/** Single-key shortcuts → action id. */
export const CHART_SHORTCUTS: Record<string, string> = { n: "progress_note", o: "med_order", t: "task", m: "message_patient" };

/** Shortcut keys are ignored while typing in a field. */
export function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t || !t.tagName) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || !!t.closest?.("[role=dialog] input, [cmdk-input]");
}

const recent: { label: string; sectionId: string; at: number }[] = [];

type Available = { action: ChartAction; answer: ChartActionAnswer };

export function ChartActionLauncher({
  patientId,
  sections,
  onSelectSection,
}: {
  patientId: string;
  sections: RecordSection[];
  onSelectSection: (id: string) => void;
}) {
  const { role, staffId, clinicianId } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [drawer, setDrawer] = useState<Available | null>(null);

  const available: Available[] = useMemo(
    () =>
      CHART_ACTIONS.filter((a) => !a.pending && a.menu !== false)
        .map((action) => ({ action, answer: action.allowed({ role, staffId, clinicianId }, patient) }))
        .filter((x) => x.answer.state !== "hidden"),
    [role, staffId, clinicianId, patient],
  );
  const hideAll = NO_BUTTON_ROLES.includes(role);
  // §Batch D — actions the role can't take. Never listed, but a search that
  // names one shows it muted; choosing it records a blocked attempt.
  const [cmdQuery, setCmdQuery] = useState("");
  const unavailable: ChartAction[] = useMemo(
    () =>
      CHART_ACTIONS.filter(
        (a) => !a.pending && a.menu !== false && a.allowed({ role, staffId, clinicianId }, patient).state === "hidden",
      ),
    [role, staffId, clinicianId, patient],
  );
  const attemptBlocked = (id: string) => {
    const reason = recordBlockedAttempt(id, { role, staffId, clinicianId }, patient);
    setCmdOpen(false);
    toast.error(`${reason ?? "That action isn't available for your role."} This attempt was recorded.`);
  };

  const open = (id: string) => {
    const hit = available.find((x) => x.action.id === id);
    if (!hit) {
      if (unavailable.some((a) => a.id === id)) {
        attemptBlocked(id);
        return true;
      }
      return false;
    }
    setMenuOpen(false);
    setCmdOpen(false);
    setDrawer(hit);
    return true;
  };

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!open(id)) toast.error("That action isn't available for your role.");
    };
    window.addEventListener(CHART_ACTION_EVENT, onOpen);
    return () => window.removeEventListener(CHART_ACTION_EVENT, onOpen);
  });

  // §Turn 3 (b) — actions that render an existing section in the drawer:
  // when the drawer closes after something was saved (a new audit row for
  // this patient), the toast links to where the created item lives.
  const [auditAtOpen, setAuditAtOpen] = useState(0);
  const auditCount = () => AdelanteEHR.listAuditEvents({ patientId }).length;
  useEffect(() => {
    if (drawer) setAuditAtOpen(auditCount());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer]);
  const closeDrawer = () => {
    const d = drawer;
    setDrawer(null);
    if (!d || ["lab_order", "screener_request", "metabolic", "document_upload", "contact_log"].includes(d.action.id)) return;
    if (auditCount() > auditAtOpen && d.action.sectionId) {
      const sid = d.action.sectionId;
      recent.unshift({ label: `${d.action.label.en} saved`, sectionId: sid, at: Date.now() });
      recent.splice(8);
      toast.success(confirmationFor(d.action.id, `${d.action.label.en} saved`), { action: { label: "View", onClick: () => onSelectSection(sid) } });
    }
  };

  useEffect(() => {
    if (hideAll) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (drawer || cmdOpen) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      const id = CHART_SHORTCUTS[e.key.toLowerCase()];
      if (id && open(id)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (hideAll || !patient) return null;

  const done: FormDone = (message, sectionId) => {
    if (drawer) message = confirmationFor(drawer.action.id, message);
    recent.unshift({ label: message, sectionId, at: Date.now() });
    recent.splice(8);
    setDrawer(null);
    toast.success(message, { action: { label: "View", onClick: () => onSelectSection(sectionId) } });
  };

  const drawerBody = (a: Available): ReactNode => {
    switch (a.action.id) {
      case "lab_order":
        return <LabOrderForm patientId={patientId} onDone={done} />;
      case "screener_request":
        return <ScreenerRequestForm patientId={patientId} onDone={done} />;
      case "metabolic":
        return <MetabolicForm patientId={patientId} onDone={done} />;
      case "document_upload":
        return <DocumentUploadForm patientId={patientId} onDone={done} />;
      case "contact_log":
        return <ContactLogForm patientId={patientId} onDone={done} />;
    }
    const sec = sections.find((s) => s.id === a.action.sectionId);
    // §Turn 5 — "Draft with Adel" sits above the existing form.
    if (a.action.id === "refill_decision") return <RefillDecisionPanel patientId={patientId} />;
    if (a.action.id === "progress_note" || a.action.id === "message_patient")
      return (
        <div className="space-y-4">
          {a.action.id === "progress_note" ? <NoteDraftPanel patientId={patientId} /> : <OutreachDraftPanel patientId={patientId} />}
          {sec?.render()}
        </div>
      );
    if (sec) return sec.render();
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>This action isn't available on this chart for your role.</p>
      </div>
    );
  };

  const shortcutFor = (id: string) => Object.entries(CHART_SHORTCUTS).find(([, v]) => v === id)?.[0]?.toUpperCase();

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            data-testid="chart-new-button"
            className="fixed bottom-16 right-4 z-50 sm:right-6 h-12 rounded-full px-5 shadow-lg print:hidden"
            aria-label="New — add to this chart"
          >
            <Plus className="h-5 w-5" /> New
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-80 max-h-[70vh] overflow-y-auto p-2" data-testid="chart-add-menu">
          <p className="px-2 pb-1 text-sm font-medium text-navy">Add to this chart</p>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setCmdOpen(true);
            }}
            className="mb-2 flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1">Search or add anything…</span>
            <kbd className="rounded border px-1 text-[10px]">⌘K</kbd>
          </button>
          {available.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No actions for your role</p>
          ) : (
            GROUPS.map((g) => {
              const items = available.filter((x) => x.action.group === g.id);
              if (!items.length) return null;
              return (
                <div key={g.id} className="mb-2">
                  <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{g.label}</p>
                  <ul>
                    {items.map((x) => (
                      <li key={x.action.id}>
                        <button
                          type="button"
                          data-testid={`chart-add-${x.action.id}`}
                          onClick={() => open(x.action.id)}
                          className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <span className="flex w-full items-center gap-2">
                            <span className="flex-1 text-navy">{x.action.label.en}</span>
                            {shortcutFor(x.action.id) && (
                              <kbd className="rounded border px-1 text-[10px] text-muted-foreground">{shortcutFor(x.action.id)}</kbd>
                            )}
                          </span>
                          {x.answer.state === "cosign" && (
                            <span className="text-[11px] text-muted-foreground">{x.answer.reason}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex w-full items-center gap-2 px-2 pt-1 text-[11px] text-muted-foreground hover:underline"
          >
            <Keyboard className="h-3 w-3" /> Keyboard shortcuts (?)
          </button>
        </PopoverContent>
      </Popover>

      <Popover open={helpOpen} onOpenChange={setHelpOpen}>
        <PopoverTrigger asChild>
          <span className="fixed bottom-32 right-6 h-0 w-0" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-64 text-sm" data-testid="chart-shortcut-help">
          <p className="mb-2 font-medium text-navy">Keyboard shortcuts</p>
          <ul className="space-y-1 text-xs">
            <li><kbd className="rounded border px-1">Ctrl/⌘ K</kbd> Search or add anything</li>
            <li><kbd className="rounded border px-1">N</kbd> New note</li>
            <li><kbd className="rounded border px-1">O</kbd> New order (prescribers)</li>
            <li><kbd className="rounded border px-1">T</kbd> Task</li>
            <li><kbd className="rounded border px-1">M</kbd> Message</li>
            <li><kbd className="rounded border px-1">?</kbd> This help</li>
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">Ignored while typing in a field.</p>
        </PopoverContent>
      </Popover>

      <CommandDialog open={cmdOpen} onOpenChange={(v) => { setCmdOpen(v); if (!v) setCmdQuery(""); }}>
        <CommandInput placeholder="Search or add anything…" value={cmdQuery} onValueChange={setCmdQuery} />
        <CommandList data-testid="chart-command-list">
          <CommandEmpty>No matches.</CommandEmpty>
          {available.length > 0 && (
            <CommandGroup heading="Add to this chart">
              {available.map((x) => (
                <CommandItem key={x.action.id} value={`add ${x.action.label.en}`} onSelect={() => open(x.action.id)}>
                  <Plus className="h-4 w-4" />
                  <span className="flex-1">{x.action.label.en}</span>
                  {x.answer.state === "cosign" && <span className="text-[10px] text-muted-foreground">cosign</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {cmdQuery.trim().length >= 3 && unavailable.length > 0 && (
            <CommandGroup heading="Not available for your role">
              {unavailable.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`add ${a.label.en} unavailable`}
                  onSelect={() => attemptBlocked(a.id)}
                  className="text-muted-foreground"
                  data-testid={`chart-unavailable-${a.id}`}
                >
                  <span className="flex-1">{a.label.en}</span>
                  <span className="text-[10px]">not available</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Go to section">
            {sections.map((s) => (
              <CommandItem
                key={s.id}
                value={`section ${s.label}`}
                onSelect={() => {
                  setCmdOpen(false);
                  onSelectSection(s.id);
                }}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {recent.length > 0 && (
            <CommandGroup heading="Recent">
              {recent.map((r) => (
                <CommandItem
                  key={r.at}
                  value={`recent ${r.label} ${r.at}`}
                  onSelect={() => {
                    setCmdOpen(false);
                    onSelectSection(r.sectionId);
                  }}
                >
                  {r.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      <Sheet open={!!drawer} onOpenChange={(v) => !v && closeDrawer()}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "max-h-[88vh] overflow-y-auto" : "w-full overflow-y-auto sm:max-w-xl"}
          data-testid="chart-action-drawer"
        >
          {drawer && (
            <div className="space-y-4">
              <div>
                <SheetTitle className="text-navy">{drawer.action.label.en}</SheetTitle>
                <SheetDescription className="text-xs">
                  {patient.firstName} {patient.lastName}
                  {drawer.answer.state === "cosign" ? ` · ${drawer.answer.reason}` : ""}
                </SheetDescription>
                {drawer.answer.state === "cosign" && (
                  <Badge variant="outline" className="mt-1 text-[10px]">{drawer.answer.reason}</Badge>
                )}
              </div>
              {drawerBody(drawer)}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
