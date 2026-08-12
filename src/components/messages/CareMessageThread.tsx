// §Messaging Phase 2 — shared thread renderer for both sides.
// Patient bodies are rendered verbatim: never translated, never edited.
import { AdelanteEHR, type CareMessage } from "@/lib/ehr";
import { ClientDate } from "@/components/ClientDate";
import { STAFF_ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Display attribution for a staff-authored message, e.g. "Peer specialist". */
export function staffRoleLabel(m: CareMessage): string | undefined {
  if (m.authorType !== "staff" || !m.authorRole) return undefined;
  return STAFF_ROLES.find((r) => r.key === m.authorRole)?.label;
}

export function CareMessageThread({
  messages,
  side,
  emptyLabel,
  youLabel,
  themLabel,
  maskBody,
  canFlag,
  onToggleFlag,
  showFlagProvenance,
}: {
  messages: CareMessage[];
  /** Whose perspective is reading — their own messages align right. */
  side: "patient" | "staff";
  emptyLabel: string;
  youLabel: string;
  themLabel: string;
  /** Staff-side Part 2 gate. Omitted on the patient side — patients always
   *  see their own thread in full. */
  maskBody?: (m: CareMessage) => boolean;
  canFlag?: boolean;
  onToggleFlag?: (m: CareMessage) => void;
  /** Staff side only — shows WHO flagged (patient vs reviewer). */
  showFlagProvenance?: boolean;
}) {
  if (messages.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {messages.map((m) => {
        const mine = m.authorType === side;
        const masked = maskBody?.(m) ?? false;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg border px-3 py-2 text-sm",
                mine ? "bg-teal/10 border-teal/30" : "bg-muted/40",
              )}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {mine ? youLabel : themLabel} · {m.authorName}
                {staffRoleLabel(m) ? ` (${staffRoleLabel(m)})` : ""} ·{" "}
                <ClientDate value={m.createdAt} />
              </div>
              {/* The flag itself is always visible, even when the body is not:
                  a clinician without consent access should know something was
                  flagged here, not find a silently missing message. */}
              {m.sudFlagged && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-destructive">
                  <ShieldAlert className="h-3 w-3" />
                  {showFlagProvenance
                    ? m.sudFlaggedByPatient
                      ? "Sensitive content flagged — patient requested"
                      : `Sensitive content flagged — flagged by ${m.sudFlaggedBy ?? "staff"}`
                    : "Sensitive content flagged"}
                </div>
              )}
              {masked ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Sensitive message — 42 CFR Part 2 consent required
                </p>
              ) : (
                /* Verbatim — whitespace preserved, content untouched. */
                <p className="mt-0.5 whitespace-pre-wrap text-foreground">{m.body}</p>
              )}
              {canFlag && onToggleFlag && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 px-1.5 text-[10px]"
                  onClick={() => onToggleFlag(m)}
                >
                  {m.sudFlagged ? "Remove Part 2/SUD flag" : "Flag as Part 2/SUD"}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function useCareMessages(patientId: string) {
  return AdelanteEHR.listCareMessages(patientId);
}
