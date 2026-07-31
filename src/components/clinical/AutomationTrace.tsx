// §Clinical documentation Phase 3c — provenance chrome for automation output.
//
// This is the part that makes post-sign automation SAFE rather than spooky:
// anything an automation created says so, names the note it came from, and
// links back to that note. Both consumers (the chart's Tasks tab and the case
// manager queue) render the same component, so the wording can't drift.

import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CaseTask, ProgressNote } from "@/lib/ehr";

function sourceLabel(title?: string) {
  return title?.trim() ? `“${title.trim()}”` : "a signed note";
}

/** Trace line under an automation-created task. Renders nothing otherwise. */
export function AutoCreatedFromNote({ task }: { task: CaseTask }) {
  if (!task.sourceNoteId) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
      <Sparkles className="h-3 w-3 text-teal" aria-hidden />
      <span>Auto-created from {sourceLabel(task.sourceTemplateTitle)}</span>
      <Link
        to="/record/$patientId"
        params={{ patientId: task.patientId }}
        search={{ section: "notes" }}
        className="underline"
      >
        View source note
      </Link>
    </div>
  );
}

/** Badge + trace line on a draft note an automation started. */
export function AutoStartedNoteTrace({ note }: { note: ProgressNote }) {
  const origin = note.automationOrigin;
  if (!origin) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
      <Sparkles className="h-3 w-3 text-teal" aria-hidden />
      <span>
        Auto-started from {sourceLabel(origin.sourceTemplateTitle)} — {origin.label}. Unsigned: a
        clinician still authors and signs this note.
      </span>
    </div>
  );
}

/** Small chip for lists where a full trace line is too heavy. */
export function AutomationBadge({ label = "Automation" }: { label?: string }) {
  return (
    <Badge className="border-0 bg-teal/15 text-[10px] text-teal-foreground">
      <Sparkles className="mr-1 h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
