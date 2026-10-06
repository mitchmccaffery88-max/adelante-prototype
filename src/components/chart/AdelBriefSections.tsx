// §Faster Adel Brief — renders the four fixed sections straight from the
// background cache (peekAdelBrief never blocks on a recompute). Each bullet:
// source chip → chart section, data date, "New" when newer than the viewer's
// last view. Optional "Adel summary (Simulated)" narrative with provenance.
import { useState, useSyncExternalStore } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  BRIEF_SECTIONS, BRIEF_SECTIONS_DRAFT, adelSummary, briefSnapshot, getBriefActions, isBulletNew, peekAdelBrief,
  sourceChipLabel, subscribeBrief,
} from "@/lib/adelBrief";
import { BRIEF_DRAFT_LABEL } from "@/lib/chartBrief";
import { simulatedSurfaceLabel } from "@/lib/features";
import { openChartAction } from "@/lib/chartActionBus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—");
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString([], { month: "short", day: "numeric" });

export function AdelBriefSections({
  patientId, lastSeen, onSelectSection, onNavigate,
}: {
  patientId: string;
  /** Viewer's previous "last opened" stamp — bullets newer than this are marked New. */
  lastSeen?: string;
  onSelectSection: (id: string) => void;
  onNavigate?: () => void;
}) {
  const { role, staffId } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  useSyncExternalStore(subscribeBrief, briefSnapshot, briefSnapshot);
  const [summaryOn, setSummaryOn] = useState(false);
  const [summary, setSummary] = useState<ReturnType<typeof adelSummary>>([]);
  if (!patient) return null;
  const entry = peekAdelBrief(patient, role);
  const actions = getBriefActions(patient, role, staffId);
  const go = (sectionId: string) => {
    onNavigate?.();
    onSelectSection(sectionId);
  };

  return (
    <div className="space-y-4 text-sm" data-testid="adel-brief-sections">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">{BRIEF_DRAFT_LABEL}</Badge>
        <span data-testid="brief-updated">Updated {hhmm(entry.computedAsOf)}</span>
        {entry.refreshing.size > 0 && <span className="animate-pulse motion-reduce:animate-none" data-testid="brief-refreshing">Refreshing…</span>}
      </div>

      <label className="flex items-center gap-2 text-xs">
        <Switch
          checked={summaryOn}
          aria-label="Adel summary (Simulated)"
          data-testid="adel-summary-toggle"
          onCheckedChange={(v) => {
            setSummaryOn(v);
            if (v) setSummary(adelSummary(entry, { staffId, role }));
          }}
        />
        Adel summary <Badge variant="outline" className="text-[10px]">{simulatedSurfaceLabel("llm_simulated")}</Badge>
      </label>
      {summaryOn && (
        <div className="rounded-md border bg-muted/40 p-2 text-sm" data-testid="adel-summary">
          {summary.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing to summarize yet.</p>
          ) : (
            summary.map((s, i) => (
              <p key={i} className="mb-1 last:mb-0">
                {s.text}{" "}
                <span className="text-[10px] text-muted-foreground" title="From these bullets">[{s.sourceIds.map((x) => x.split(":")[1]).join(", ")}]</span>
              </p>
            ))
          )}
        </div>
      )}

      {BRIEF_SECTIONS.map(({ id, title }) => {
        const sec = entry.sections[id];
        return (
          <section key={id} data-testid={`brief-section-${id}`}>
            <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
              {entry.refreshing.has(id) && <span className="font-normal normal-case">Refreshing…</span>}
            </h3>
            {!sec || sec.bullets.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing to flag.</p>
            ) : (
              <ul className="space-y-1.5">
                {sec.bullets.map((b) => (
                  <li key={b.id} className="flex items-start gap-2" data-testid={`brief-bullet-${id}-${b.id}`}>
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-navy" />
                    <span className="flex-1">
                      {b.text}
                      <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
                        <button type="button" onClick={() => go(b.sectionId)} className="rounded border px-1.5 text-[10px] text-navy hover:bg-muted" data-testid="brief-source-chip">
                          {sourceChipLabel(b.sectionId)}
                        </button>
                        <span className="text-[10px] text-muted-foreground">{day(b.at)}</span>
                        {isBulletNew(b, lastSeen) && <Badge className="h-4 px-1 text-[10px]" data-testid="brief-new">New</Badge>}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested next actions</h3>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.actionId} size="sm" variant="outline" data-testid={`brief-action-${a.actionId}`} onClick={() => { onNavigate?.(); openChartAction(a.actionId); }}>
              {a.label}
            </Button>
          ))}
        </div>
      </section>
      <p className="text-[10px] text-muted-foreground">{BRIEF_SECTIONS_DRAFT}</p>
    </div>
  );
}
