// §Chart redesign turn 3 — compact, pinned chart header. Three columns
// (identity / care status / actions) plus Allergies and Alerts strips. It
// condenses on scroll. Everything is derived in src/lib/chartBrief.ts with
// the chart's own Part 2 rules.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, History, MessageSquare, Sparkles, StickyNote as StickyIcon } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { episodeHeaderLabel } from "@/lib/outpatientCare";
import {
  BRIEF_DRAFT_LABEL, STICKY_HINT, adelBrief, ageFromDob, briefHasNew, canEditSticky, canReadSticky, careTeam,
  chartEvents, getStickyNote, headerAlerts, markBriefSeen, mediCalChip, reentryDay, setStickyNote,
} from "@/lib/chartBrief";
import { openChartAction } from "@/lib/chartActionBus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { AllergiesTab } from "@/components/clinical/ClinicalRecordTabs";

const LANG: Record<string, string> = { en: "English", es: "Spanish" };

export function ChartHeader({
  patientId,
  visibleSections,
  onSelectSection,
  more,
  tabBar,
}: {
  patientId: string;
  visibleSections: string[];
  onSelectSection: (id: string) => void;
  more: ReactNode;
  tabBar?: ReactNode;
}) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId))!;
  const { role, staffId, staffName } = useActingStaff();
  const [condensed, setCondensed] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  useEffect(() => {
    const on = () => setCondensed(window.scrollY > 140);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const episode = useEhr(() => episodeHeaderLabel(patientId, role));
  const team = careTeam(patient);
  const medi = mediCalChip(patient);
  const rd = reentryDay(patient);
  const alertsJson = useEhr(() => JSON.stringify(headerAlerts(AdelanteEHR.getPatient(patientId)!, role, visibleSections)));
  const alerts = JSON.parse(alertsJson) as ReturnType<typeof headerAlerts>;
  const glow = useEhr(() => briefHasNew(AdelanteEHR.getPatient(patientId)!, role, staffId));
  const note = useEhr(() => getStickyNote(patientId));
  const allergyAccess = canAccess(role, "allergies", patient);
  const allergies = useEhr(() => AdelanteEHR.listAllergies(patientId));
  const age = ageFromDob(patient.dob);

  return (
    <header
      data-testid="chart-header"
      data-condensed={condensed ? "true" : "false"}
      className="sticky top-[34px] z-30 border-b border-border bg-card/95 backdrop-blur"
    >
      <div className={`mx-auto max-w-[1600px] px-4 ${condensed ? "py-2" : "py-3"} space-y-2`}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] md:items-start">
          {/* Identity */}
          <div className="min-w-0" data-testid="chart-header-identity">
            {!condensed && (
              <Link to="/case-manager" className="inline-flex items-center gap-1 text-xs text-teal">
                <ArrowLeft className="h-3 w-3" /> Back to caseload
              </Link>
            )}
            <h1 className={`truncate font-display text-navy ${condensed ? "text-lg" : "text-2xl"}`}>
              {patient.firstName} {patient.lastName}
              {patient.preferredName && <span className="ml-2 text-sm text-muted-foreground">“{patient.preferredName}”</span>}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {age !== undefined ? `${age} y · ` : ""}
              {patient.dob ? `DOB ${patient.dob} · ` : ""}
              {patient.programId}
              {patient.preferredLanguage ? ` · ${LANG[patient.preferredLanguage] ?? patient.preferredLanguage}` : ""}
            </p>
          </div>

          {/* Care status */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="chart-header-status">
            {episode && <Badge variant="outline">Episode: {episode}</Badge>}
            {rd && (
              <Badge variant="secondary" data-testid="reentry-day">Reentry day {rd}</Badge>
            )}
            {medi && (
              <Badge variant={medi === "active" ? "secondary" : "outline"} data-testid="medi-cal-chip">
                Medi-Cal: {medi === "active" ? "active" : "needs check"}
              </Badge>
            )}
            {!condensed &&
              team.map((t) => (
                <button
                  key={t.role}
                  type="button"
                  onClick={() => (visibleSections.includes("messages") ? onSelectSection("messages") : toast.info(`${t.label}: ${t.name}`))}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-navy hover:bg-muted"
                  title={`Message about this patient — ${t.name}`}
                >
                  <MessageSquare className="h-3 w-3" />
                  <span className="text-muted-foreground">{t.label}:</span> {t.name}
                </button>
              ))}
            {note && canReadSticky(role, patient) && (
              <span data-testid="sticky-chip" className="inline-flex max-w-full items-center gap-1 truncate rounded-md border border-gold/60 bg-gold/25 px-2 py-0.5 text-xs text-navy">
                <StickyIcon className="h-3 w-3 shrink-0" /> {note.text}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
            <Button
              size="sm"
              variant="outline"
              data-testid="adel-brief-button"
              data-glow={glow ? "true" : "false"}
              onClick={() => {
                setBriefOpen(true);
                markBriefSeen(staffId, patientId);
              }}
              className={glow ? "ring-2 ring-gold shadow-[0_0_12px_var(--gold)] animate-pulse motion-reduce:animate-none" : ""}
            >
              <Sparkles className="h-4 w-4" /> Adel Brief
            </Button>
            <StickyNoteButton patientId={patientId} canEdit={canEditSticky(role)} canRead={canReadSticky(role, patient)} actor={{ name: staffName, role }} />
            <RecentActivity patientId={patientId} onSelectSection={onSelectSection} />
            {more}
          </div>
        </div>

        {!condensed && (
          <div className="space-y-1.5">
            {allergyAccess.level !== "none" && !allergyAccess.locked && (
              <div data-testid="allergy-strip" className="flex flex-wrap items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs">
                <span className="font-semibold text-destructive">Allergies:</span>
                {allergies.length === 0 ? (
                  <span className="text-muted-foreground">None recorded — confirm NKDA</span>
                ) : (
                  allergies.map((a) => (
                    <span key={a.id} className="font-medium text-destructive">
                      {a.substance}
                      {a.reaction ? ` (${a.reaction})` : ""}
                      {a.severity === "severe" ? " · severe" : ""}
                    </span>
                  ))
                )}
                {allergyAccess.level === "write" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="ml-auto text-teal underline" data-testid="allergy-edit">Edit</button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[min(92vw,520px)] max-h-[70vh] overflow-y-auto">
                      <AllergiesTab patientId={patientId} />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
            {alerts.length > 0 && (
              <div data-testid="alert-strip" className="flex flex-wrap items-center gap-1.5 rounded-md border border-gold/60 bg-gold/15 px-2 py-1 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-navy" />
                {alerts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelectSection(a.sectionId)}
                    className={`rounded px-1.5 py-0.5 font-medium hover:underline ${a.tone === "red" ? "text-destructive" : "text-navy"}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {tabBar && <div className="mx-auto max-w-[1600px] px-4">{tabBar}</div>}
      <AdelBriefPanel open={briefOpen} onOpenChange={setBriefOpen} patientId={patientId} episode={episode} onSelectSection={onSelectSection} />
    </header>
  );
}

function StickyNoteButton({ patientId, canEdit, canRead, actor }: { patientId: string; canEdit: boolean; canRead: boolean; actor: { name: string; role: string } }) {
  const note = useEhr(() => getStickyNote(patientId));
  const [text, setText] = useState(note?.text ?? "");
  if (!canRead) return null;
  return (
    <Popover onOpenChange={(o) => o && setText(getStickyNote(patientId)?.text ?? "")}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" data-testid="sticky-button">
          <StickyIcon className="h-4 w-4" /> Sticky note
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="text-sm font-medium text-navy">Team sticky note</p>
        <p className="text-xs text-muted-foreground">{STICKY_HINT}</p>
        {canEdit ? (
          <>
            <Input aria-label="Sticky note" maxLength={120} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Prefers texts after 3pm" />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  try {
                    setStickyNote(patientId, text, actor);
                    toast.success(text.trim() ? "Sticky note saved" : "Sticky note cleared");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Save
              </Button>
              {note && (
                <Button size="sm" variant="ghost" onClick={() => { setStickyNote(patientId, "", actor); setText(""); }}>
                  Clear
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm">{note?.text ?? "No sticky note."}</p>
        )}
        {note && <p className="text-[11px] text-muted-foreground">{note.by} · {new Date(note.at).toLocaleString()}</p>}
      </PopoverContent>
    </Popover>
  );
}

function RecentActivity({ patientId, onSelectSection }: { patientId: string; onSelectSection: (id: string) => void }) {
  const { role } = useActingStaff();
  const json = useEhr(() => JSON.stringify(chartEvents(AdelanteEHR.getPatient(patientId)!, role).slice(0, 10)));
  const events = JSON.parse(json) as ReturnType<typeof chartEvents>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" data-testid="recent-activity-button">
          <History className="h-4 w-4" /> Recent activity
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="mb-2 text-sm font-medium text-navy">Recent activity</p>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing recent.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {events.map((e, i) => (
              <li key={i}>
                <button type="button" className="flex w-full gap-2 text-left hover:underline" onClick={() => onSelectSection(e.sectionId)}>
                  <span className="w-12 shrink-0 text-muted-foreground">{new Date(e.at).toLocaleDateString([], { month: "numeric", day: "numeric" })}</span>
                  <span>{e.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AdelBriefPanel({
  open, onOpenChange, patientId, episode, onSelectSection,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  episode?: string;
  onSelectSection: (id: string) => void;
}) {
  const { role, staffId } = useActingStaff();
  const json = useEhr(() => (open ? JSON.stringify(adelBrief(AdelanteEHR.getPatient(patientId)!, role, staffId, episode)) : ""));
  const b = json ? (JSON.parse(json) as ReturnType<typeof adelBrief>) : undefined;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto pt-14 sm:max-w-md" data-testid="adel-brief-panel">
        <SheetTitle className="text-navy">Adel Brief</SheetTitle>
        <SheetDescription className="text-xs">
          <Badge variant="outline" className="text-[10px]">{BRIEF_DRAFT_LABEL}</Badge> Rule-based, from what this chart shows your role.
        </SheetDescription>
        {b && (
          <div className="mt-4 space-y-5 text-sm">
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h3>
              <ul className="list-disc space-y-1 pl-5">
                {b.bullets.length ? b.bullets.map((x, i) => <li key={i}>{x}</li>) : <li>Not much on file yet.</li>}
              </ul>
            </section>
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What changed since the last visit ({new Date(b.since).toLocaleDateString()})
              </h3>
              {b.changed.length === 0 ? (
                <p className="text-xs text-muted-foreground">No changes.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {b.changed.map((e, i) => (
                    <li key={i}>
                      <button type="button" className="text-left hover:underline" onClick={() => { onOpenChange(false); onSelectSection(e.sectionId); }}>
                        {new Date(e.at).toLocaleDateString()} — {e.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested next actions</h3>
              <div className="flex flex-wrap gap-2">
                {b.actions.map((a) => (
                  <Button key={a.actionId} size="sm" variant="outline" data-testid={`brief-action-${a.actionId}`} onClick={() => { onOpenChange(false); openChartAction(a.actionId); }}>
                    {a.label}
                  </Button>
                ))}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
