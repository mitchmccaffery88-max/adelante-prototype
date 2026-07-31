// §Messaging Phase 2 — shared thread renderer for both sides.
// Patient bodies are rendered verbatim: never translated, never edited.
import { AdelanteEHR, type CareMessage } from "@/lib/ehr";
import { ClientDate } from "@/components/ClientDate";
import { cn } from "@/lib/utils";

export function CareMessageThread({
  messages,
  side,
  emptyLabel,
  youLabel,
  themLabel,
}: {
  messages: CareMessage[];
  /** Whose perspective is reading — their own messages align right. */
  side: "patient" | "staff";
  emptyLabel: string;
  youLabel: string;
  themLabel: string;
}) {
  if (messages.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {messages.map((m) => {
        const mine = m.authorType === side;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg border px-3 py-2 text-sm",
                mine ? "bg-teal/10 border-teal/30" : "bg-muted/40",
              )}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {mine ? youLabel : themLabel} · {m.authorName} · <ClientDate value={m.createdAt} />
              </div>
              {/* Verbatim — whitespace preserved, content untouched. */}
              <p className="mt-0.5 whitespace-pre-wrap text-foreground">{m.body}</p>
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
