// §Adelante Journey Phase 7 part 1 — Safety Plan UI (Stanley-Brown).
//
// One component for both surfaces: the patient authors it on /home, clinical
// staff read (or co-edit) it as a chart section. The clinical-review-pending
// banner is rendered from the real `SAFETY_PLAN_REVIEW` flag — it disappears
// only when that flag is cleared after Christi / Dr. Bagga sign off.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  CRISIS_LIFELINE_NUMBER,
  SAFETY_PLAN_REVIEW,
  SAFETY_PLAN_SECTIONS,
  type SafetyPlanSectionId,
} from "@/lib/safetyPlan";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClientDate } from "@/components/ClientDate";
import { LifeBuoy, Lock, Phone, Plus, Trash2, TriangleAlert } from "lucide-react";

export function ClinicalReviewPendingBanner({ className = "" }: { className?: string }) {
  if (!SAFETY_PLAN_REVIEW.pending) return null;
  return (
    <div
      data-testid="safety-plan-review-pending"
      className={`flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-900 dark:text-amber-200 ${className}`}
    >
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {SAFETY_PLAN_REVIEW.notice} <span className="opacity-80">{SAFETY_PLAN_REVIEW.scope}</span>
      </span>
    </div>
  );
}

export function SafetyPlanPanel({
  patientId,
  readOnly = false,
  author = "patient",
  actorRole = "patient",
}: {
  patientId: string;
  readOnly?: boolean;
  author?: string;
  actorRole?: string;
}) {
  const summary = useEhr(() => AdelanteEHR.safetyPlanSummary(patientId));
  const entries = useEhr(() => AdelanteEHR.safetyPlanEntries(patientId));

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <LifeBuoy className="h-4 w-4" /> Safety plan
          </div>
          <Badge variant="outline" className="text-[10px]">
            {summary.sectionsFilled}/{summary.totalSections} sections started
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Your own plan, in your words, for a hard moment. Stanley-Brown structure. If you are in
          crisis right now, call or text{" "}
          <a href={`tel:${CRISIS_LIFELINE_NUMBER}`} className="font-semibold underline">
            {CRISIS_LIFELINE_NUMBER}
          </a>
          .
        </p>
        <ClinicalReviewPendingBanner />
        {summary.lastReviewedAt && (
          <p className="text-[11px] text-muted-foreground">
            Last reviewed with {summary.lastReviewedAt ? "care team" : ""} ·{" "}
            <ClientDate value={summary.lastReviewedAt} />
          </p>
        )}
      </Card>

      {SAFETY_PLAN_SECTIONS.map((section) => (
        <SafetyPlanSection
          key={section.id}
          patientId={patientId}
          sectionId={section.id}
          readOnly={readOnly}
          author={author}
          actorRole={actorRole}
          rows={entries.filter((e) => e.sectionId === section.id)}
        />
      ))}
    </div>
  );
}

function SafetyPlanSection({
  patientId,
  sectionId,
  readOnly,
  author,
  actorRole,
  rows,
}: {
  patientId: string;
  sectionId: SafetyPlanSectionId;
  readOnly: boolean;
  author: string;
  actorRole: string;
  rows: ReturnType<typeof AdelanteEHR.safetyPlanEntries>;
}) {
  const def = SAFETY_PLAN_SECTIONS.find((s) => s.id === sectionId)!;
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("");

  const add = () => {
    try {
      AdelanteEHR.addSafetyPlanEntry(patientId, {
        sectionId,
        text,
        ...(def.contactSection && phone.trim() ? { phone } : {}),
        source: actorRole === "patient" ? "patient" : "staff",
        author,
        actorRole,
      });
      setText("");
      setPhone("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  };

  const remove = (id: string) => {
    try {
      AdelanteEHR.removeSafetyPlanEntry(patientId, id, { actorRole });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove.");
    }
  };

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-muted-foreground">{def.step}</span>
        <h3 className="text-xs font-medium text-navy">{def.title}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {def.prompt}
        {def.clinicalReviewPending && (
          <span className="ml-1 rounded bg-amber-500/15 px-1 text-[10px] text-amber-700 dark:text-amber-300">
            draft prompt — pending clinical review
          </span>
        )}
      </p>

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Nothing here yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-2 rounded border bg-muted/30 p-2 text-[11px]"
            >
              <div className="min-w-0">
                <p className="text-navy break-words">{r.text}</p>
                {r.phone && (
                  <a
                    href={`tel:${r.phone}`}
                    className="mt-0.5 inline-flex items-center gap-1 underline"
                  >
                    <Phone className="h-3 w-3" /> {r.phone}
                  </a>
                )}
              </div>
              {r.locked ? (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> always here
                </span>
              ) : (
                !readOnly && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove entry"
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="space-y-1.5">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add your own…"
            aria-label={`Add to ${def.title}`}
          />
          {def.contactSection && (
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              aria-label={`Phone for ${def.title}`}
            />
          )}
          <Button size="sm" variant="outline" disabled={text.trim().length === 0} onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      )}
    </Card>
  );
}