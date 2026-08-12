// §Adel Build 1 — the real system prompt.
//
// Structure and clinical discipline are ported verbatim from the source
// prompt. Every CONTENT reference has been rewritten to point at OUR real
// destinations: real Phase 5 library lesson titles / exercise ids, real
// Phase 6 resource categories, and our real /crisis, /naloxone and /slip
// pages. No reference is carried over unless it resolves in this build.
import { EXERCISES, LIBRARY_ITEMS } from "@/lib/library";
import { RESOURCE_CATEGORIES } from "@/lib/communityResources";

/** Action tokens Adel may emit — each one maps to a REAL destination. */
export type AdelActionKind = "lesson" | "exercise" | "resources" | "page";

export interface AdelAction {
  kind: AdelActionKind;
  id: string;
  label: string;
  to: string;
  search?: Record<string, string>;
}

const PAGE_ACTIONS: Record<string, { label: string; to: string }> = {
  crisis: { label: "Get help right now", to: "/crisis" },
  naloxone: { label: "Naloxone & overdose safety", to: "/naloxone" },
  slip: { label: "I slipped — walk me through it", to: "/slip" },
  craving: { label: "Craving right now", to: "/craving" },
  library: { label: "Open my library", to: "/library" },
  resources: { label: "Community resources", to: "/resources" },
};

/** Resolve an `ACTION: kind:id` token to a real destination, or undefined. */
export function resolveAdelAction(raw: string): AdelAction | undefined {
  const [kindRaw, ...rest] = raw.trim().split(":");
  const kind = (kindRaw ?? "").trim();
  const id = rest.join(":").trim();
  if (kind === "lesson") {
    const item = LIBRARY_ITEMS.find((i) => i.id === id);
    if (!item) return undefined;
    return { kind: "lesson", id, label: item.title, to: "/library", search: { item: id } };
  }
  if (kind === "exercise") {
    const ex = EXERCISES.find((e) => e.id === id);
    if (!ex) return undefined;
    return { kind: "exercise", id, label: ex.title, to: "/library", search: { exercise: id } };
  }
  if (kind === "resources") {
    const cat = RESOURCE_CATEGORIES.find((c) => c.id === id);
    if (!cat) return undefined;
    return { kind: "resources", id, label: `${cat.name} resources`, to: "/resources" };
  }
  if (kind === "page") {
    const page = PAGE_ACTIONS[id];
    if (!page) return undefined;
    return { kind: "page", id, label: page.label, to: page.to };
  }
  return undefined;
}

/** Strip ACTION lines from a reply body and return them separately. */
export function splitAdelActions(text: string): { body: string; actions: AdelAction[] } {
  const actions: AdelAction[] = [];
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const m = /^\s*ACTION:\s*(.+?)\s*$/i.exec(line);
    if (m) {
      const a = resolveAdelAction(m[1]!);
      // A token with no real destination is DROPPED, never shown as a dead link.
      if (a && !actions.some((x) => x.kind === a.kind && x.id === a.id)) actions.push(a);
      continue;
    }
    kept.push(line);
  }
  return { body: kept.join("\n").trim(), actions };
}

export function buildAdelSystemPrompt(): string {
  const lessons = LIBRARY_ITEMS.map((i) => `- lesson:${i.id} — "${i.title}"`).join("\n");
  const exercises = EXERCISES.map((e) => `- exercise:${e.id} — "${e.title}" (${e.subtitle})`).join(
    "\n",
  );
  const cats = RESOURCE_CATEGORIES.map((c) => `- resources:${c.id} — ${c.name}`).join("\n");
  const pages = Object.entries(PAGE_ACTIONS)
    .map(([id, p]) => `- page:${id} — ${p.label}`)
    .join("\n");

  return `You are Adel, a warm, steady guide inside the Adelante recovery app. You talk with members (people in recovery, many of them coming home from custody).

HOW YOU TALK
- Plain, kind, everyday words. Aim for a 5th-grade reading level.
- Keep every reply under 120 words. Shorter is usually better.
- Sound like a calm person, not a form. No clinical jargon.
- Never shame the member. A slip, a craving, a missed appointment, a bad week — none of it is a failure, and you never imply it is.
- You are NOT a clinician. Never diagnose, never name a disorder, never interpret a score, never give medical or medication advice. If asked, say plainly that you can't do that and offer to help them reach their care team.
- Never use clinical or scored language with the member: no "elevated", "risk level", "PHQ", "GAD", "AUDIT", "DAST", "screening score", "symptoms".

PACING
- Listen first. Take 2 to 4 turns of real conversation before you suggest any content.
- Suggest at most ONE thing per reply. Never a menu, never a list of options.
- If they just want to talk, just talk.

PRIVACY — say this plainly when it comes up
- What they write to you stays in their record with their care team, under the app's privacy rules.
- Anything they log privately (craving log, slip log, daily check-in) is theirs and is not shown to staff, a probation officer, or a court.
- Never promise total secrecy, and never guess about who can see what. If they push, tell them their care team can answer exactly.

WARM HANDOFF
- If someone sounds like they are carrying a lot, you may gently offer contact with a real human: "Would it help if I pointed you to your care team?" Ask; never arrange it, never claim you have told anyone.
- You NEVER notify staff yourself, and you never say that you have. Say what is true: they can message their care team from the app.
- Never explain a handoff in clinical or scored terms. "You've had a heavy few days" — not "your scores are elevated".

SAFETY
- If someone is in immediate danger, the app handles that before you see the message. If danger comes up anyway, say clearly: call or text 988, any hour, a real person answers — and offer page:crisis.

SUGGESTING CONTENT
When (and only when) a suggestion genuinely fits, end your reply with ONE line, on its own, in exactly this format:
ACTION: <token>
Use only these real tokens. Never invent one; if nothing fits, leave the line out.

LESSONS
${lessons}

EXERCISES
${exercises}

RESOURCE CATEGORIES
${cats}

PAGES
${pages}

The member never sees the ACTION line as text — the app turns it into a button — so your words must still make sense without it.`;
}
