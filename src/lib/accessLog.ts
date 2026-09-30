// §Batch C2 — record-access (read) audit log. Prototype only: events live in
// the in-memory audit stream; production requires immutable storage.
// Fields: section id, actor, acting role, viewed-as, patient id, timestamp,
// simulated flag. Never content.
import { AdelanteEHR } from "./ehr";

export const ACCESS_LOG_LABEL = "Prototype access log — production requires immutable storage";
export const ACCESS_COLLAPSE_MS = 5 * 60_000;
/** sys_admin + the compliance stand-in (credentialing coordinator). */
export const ACCESS_LOG_ROLES: readonly string[] = ["sys_admin", "credentialing_coordinator"];

export type AccessKind = "open" | "section" | "print" | "export";

export interface AccessInput {
  actorId: string;
  actorName: string;
  role: string;
  patientId: string;
  sectionId: string;
  kind: AccessKind;
  viewedAs?: string;
  at?: Date;
}

const lastSeen = new Map<string, number>();

/** Returns true when a new event was written (false = collapsed duplicate). */
export function recordView(input: AccessInput): boolean {
  const now = (input.at ?? new Date()).getTime();
  const key = `${input.actorId}|${input.patientId}|${input.sectionId}`;
  const prev = lastSeen.get(key);
  if (prev !== undefined && now - prev < ACCESS_COLLAPSE_MS) return false;
  lastSeen.set(key, now);
  AdelanteEHR._recordAudit({
    category: "access",
    action: "record.viewed",
    patientId: input.patientId,
    actorId: input.actorId,
    actorRole: input.role,
    detail: {
      sectionId: input.sectionId,
      kind: input.kind,
      actorName: input.actorName,
      ...(input.viewedAs ? { viewedAs: input.viewedAs } : {}),
      at: new Date(now).toISOString(),
      simulated: true,
    },
  });
  return true;
}

export interface AccessRow {
  id: string;
  at: string;
  actorName: string;
  actorId?: string;
  role?: string;
  sectionId: string;
  kind: AccessKind;
  viewedAs?: string;
}

export function accessEventsFor(patientId?: string): AccessRow[] {
  return AdelanteEHR.listAuditEvents(patientId ? { patientId } : {})
    .filter((e) => e.action === "record.viewed")
    .map((e) => {
      const d = (e.detail ?? {}) as Record<string, unknown>;
      return {
        id: e.id,
        at: (d["at"] as string) ?? e.at,
        actorName: (d["actorName"] as string) ?? e.actorId ?? "",
        actorId: e.actorId,
        role: e.actorRole,
        sectionId: (d["sectionId"] as string) ?? "",
        kind: ((d["kind"] as AccessKind) ?? "section"),
        viewedAs: d["viewedAs"] as string | undefined,
      };
    });
}

export function _resetAccessLogForTests() {
  lastSeen.clear();
}
