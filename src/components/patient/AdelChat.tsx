// §Adel Build 1 — the real Adel chat surface.
//
// CRISIS: the pre-send check calls the REAL Phase 1 mechanism
// (detectCrisisLanguage / scanTextForCrisis). There is deliberately no second
// regex here. A tripped message never reaches the LLM.
//
// LOGGING / RETENTION — OPEN, FLAGGED, NOT DECIDED HERE:
// this conversation is held in memory for the session only. It is NOT written
// to the record, because whether an assistant transcript is Part 2-covered
// treatment information (and who may read it) is a consent/policy decision for
// Christi / Dr. Bagga, not a code decision. Do not add persistence until then.
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Compass, LifeBuoy, Loader2, MapPin, Phone, Send, ShieldAlert, Wind } from "lucide-react";
import { AdelanteEHR } from "@/lib/ehr";
import { patientVisibleResource } from "@/lib/communityResources";
import { detectCrisisLanguage, scanTextForCrisis } from "@/lib/crisisTextDetection";
import { buildAdelSystemPrompt, splitAdelActions, type AdelAction } from "@/lib/adelPrompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CRISIS_LIFELINE_NUMBER } from "@/lib/safetyPlan";

// §Small UI gaps batch item 4 — chip rendering is differentiated BY KIND only.
// Destinations still come from the real `resolveAdelAction` resolver; nothing
// about action resolution changed here.
const ACTION_STYLE: Record<
  AdelAction["kind"],
  { icon: typeof BookOpen; className: string }
> = {
  lesson: { icon: BookOpen, className: "border-primary/40 bg-primary/10 text-primary" },
  exercise: { icon: Wind, className: "border-teal/40 bg-teal/10 text-teal" },
  resources: { icon: MapPin, className: "border-gold/50 bg-gold/15 text-navy" },
  page: { icon: Compass, className: "border-border bg-secondary text-foreground" },
};

interface Turn {
  role: "user" | "assistant";
  content: string;
  actions?: AdelAction[];
  crisis?: boolean;
}

const GREETING =
  "Hi — I'm Adel. I'm here to listen and help you find your way around the app. What's going on today?";

export function AdelChat({ resourceId }: { resourceId?: string } = {}) {
  // A resource-contextual open: Adel starts on that organisation instead of a
  // cold greeting, and the patient's first message is pre-written for them.
  const contextResource = resourceId ? patientVisibleResource(resourceId) : undefined;
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content: contextResource
        ? `Hi — I'm Adel. You were just looking at ${contextResource.name}. Want help figuring out whether they're a fit, what to ask when you call, or how to get there?`
        : GREETING,
      actions: [],
    },
  ]);
  const [draft, setDraft] = useState(
    contextResource ? `Can you tell me more about ${contextResource.name}?` : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setError(null);

    // ── Real Phase 1 crisis mechanism, ahead of the LLM ────────────────────
    if (detectCrisisLanguage(text).matched) {
      const patientId = AdelanteEHR.getCurrentPatientId();
      scanTextForCrisis(patientId, text, { surface: "a message to Adel" });
      setTurns((t) => [
        ...t,
        { role: "user", content: text },
        {
          role: "assistant",
          crisis: true,
          content:
            "I'm really glad you told me. I want you to talk to a person, not me, right now. Call or text 988 — someone answers any hour, and it's free.",
          actions: [{ kind: "page", id: "crisis", label: "Get help right now", to: "/crisis" }],
        },
      ]);
      return;
    }

    const history: Turn[] = [...turns, { role: "user", content: text }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      const res = await fetch("/api/adel-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildAdelSystemPrompt(),
          messages: history
            .filter((t, i) => !(i === 0 && t.role === "assistant"))
            .map((t) => ({ role: t.role, content: t.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Adel could not answer just now.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
            };
            const piece = json.choices?.[0]?.delta?.content;
            if (!piece) continue;
            full += piece;
            const { body } = splitAdelActions(full);
            setTurns((t) => {
              const next = [...t];
              next[next.length - 1] = { role: "assistant", content: body };
              return next;
            });
          } catch {
            /* partial frame — ignore */
          }
        }
      }

      const { body, actions } = splitAdelActions(full);
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = {
          role: "assistant",
          content: body || "I'm here — say a little more?",
          actions,
        };
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adel could not answer just now.");
      setTurns((t) => t.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col gap-3 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-foreground">Adel</h1>
        <p className="text-base text-muted-foreground">
          A guide, not a clinician. Adel can&apos;t give medical advice. If you need someone now,
          call or text <span className="font-semibold">988</span>.
        </p>
      </header>

      <Card className="soft-shadow flex-1 space-y-3 p-4">
        <ul className="space-y-3">
          {turns.map((t, i) => (
            <li key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl border px-4 py-3 text-base",
                  t.role === "user"
                    ? "border-primary/30 bg-primary/10"
                    : t.crisis
                      ? "border-destructive/40 bg-destructive/5"
                      : "bg-muted/40",
                )}
              >
                {t.crisis && (
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-destructive">
                    <ShieldAlert className="h-3.5 w-3.5" /> Your care team has been alerted
                  </div>
                )}
                <p className="whitespace-pre-wrap">{t.content}</p>
                {t.actions && t.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {t.actions.map((a) => {
                      const style = ACTION_STYLE[a.kind];
                      const Icon = style.icon;
                      return (
                        <Button
                          key={`${a.kind}:${a.id}`}
                          size="sm"
                          variant="outline"
                          asChild
                          data-testid={`adel-action-${a.kind}`}
                          className={cn("rounded-full", style.className)}
                        >
                          <Link to={a.to} {...(a.search ? { search: a.search } : {})}>
                            <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            {a.label}
                          </Link>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          ))}
          {busy && (
            <li className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Adel is thinking…
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </Card>

      {/* §Small UI gaps batch item 4 — persistent, non-intrusive crisis strip.
          Visible for the whole conversation, not only in a header pill. */}
      <div
        data-testid="adel-crisis-strip"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-crisis/30 bg-crisis-soft px-3 py-2 text-sm"
      >
        <LifeBuoy className="h-4 w-4 shrink-0 text-crisis" aria-hidden="true" />
        <span className="text-muted-foreground">Need a person right now?</span>
        <Button asChild size="sm" variant="crisis" className="h-9 rounded-full">
          <a href={`tel:${CRISIS_LIFELINE_NUMBER}`}>
            <Phone className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Call {CRISIS_LIFELINE_NUMBER}
          </a>
        </Button>
        <Button asChild size="sm" variant="crisisSoft" className="h-9 rounded-full">
          <Link to="/crisis">Crisis support</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          aria-label="Message Adel"
          placeholder="Say what's on your mind…"
          className="min-h-[56px] rounded-2xl text-base"
        />
        <Button
          onClick={() => void send()}
          disabled={busy || draft.trim().length === 0}
          className="h-[56px] w-[56px] rounded-2xl p-0"
          aria-label="Send"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        This conversation isn&apos;t saved to your record yet — it clears when you leave the page.
      </p>
    </div>
  );
}
