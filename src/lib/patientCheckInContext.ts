import { AdelanteEHR, type Appointment, type RefillRequest, type Patient } from "@/lib/ehr";
import { nextOccurrenceForGroup } from "@/lib/groupMetrics";
import { CHECK_IN_COPY } from "@/lib/checkInCopy";

export interface CheckInContextItem { id: string; kind: "appointment" | "refill" | "group" | "need" | "referral"; label: string; detail?: string; at?: string; }
export interface CheckInContextSources { appointments: Appointment[]; refills: RefillRequest[]; groups: { id: string; topic: string; start: string | null }[]; patient?: Patient; }
const validTime = (s: string) => Number.isFinite(Date.parse(s));
/** Read-only patient projection. Never includes clinical notes, need logs or staff tasks. */
export function checkInContextFrom(s: CheckInContextSources, now = new Date(), lang: "en" | "es" = "en") {
  const c = CHECK_IN_COPY[lang];
  const items: CheckInContextItem[] = [];
  const next = s.appointments.filter(a => a.status === "scheduled" && validTime(a.start) && Date.parse(a.start) + a.durationMin * 60_000 > +now).sort((a,b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (next) items.push({ id: next.id, kind: "appointment", label: c.appointment, at: next.start });
  const latest = new Map<string, RefillRequest>();
  for (const r of [...s.refills].filter(r => validTime(r.requestedAt)).sort((a,b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))) if (!latest.has(r.medicationId)) latest.set(r.medicationId, r);
  for (const r of latest.values()) items.push({ id: r.id, kind: "refill", label: `${c.refill} · ${r.medicationName}`, detail: c.statuses[r.status], at: r.status === "pending" ? undefined : r.reviewedAt ?? r.requestedAt });
  for (const g of s.groups) if (g.start && validTime(g.start) && Date.parse(g.start) > +now) items.push({ id: g.id, kind: "group", label: g.topic, at: g.start });
  const visibleNeedIds = new Set<string>();
  const allNeedIds = new Set((s.patient?.sdohPlan?.items ?? []).map(n => n.id));
  for (const n of s.patient?.sdohPlan?.items ?? []) {
    if (n.visibleToPatient === false || n.status === "completed" || n.status === "not_completed") continue;
    visibleNeedIds.add(n.id);
    items.push({ id: n.id, kind: "need", label: n.need, detail: c.open });
  }
  for (const r of s.patient?.resourceReferrals ?? []) {
    if (r.visibleToPatient === false || !["pending", "waitlisted", "unreachable"].includes(r.status)) continue;
    // A hidden/closed parent need never becomes visible through a referral.
    if (r.sdohItemId && (visibleNeedIds.has(r.sdohItemId) || allNeedIds.has(r.sdohItemId))) continue;
    items.push({ id: r.id, kind: "referral", label: c.referral, detail: c.open });
  }
  const tz = s.patient?.facilityTimezone;
  const key = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const todayKey = key(now);
  const end = new Date(now); end.setDate(end.getDate() + 7);
  const today = items.filter(i => !i.at || key(new Date(i.at)) === todayKey);
  const week = items.filter(i => !i.at || (Date.parse(i.at) >= +now && Date.parse(i.at) <= +end));
  return { items, happening: today.length ? today : week, period: today.length ? "today" as const : "week" as const };
}
export function patientCheckInContext(patientId: string, now = new Date(), lang: "en" | "es" = "en") {
  return checkInContextFrom({ patient: AdelanteEHR.getPatient(patientId), appointments: AdelanteEHR.appointmentsForPatient(patientId), refills: AdelanteEHR.listRefillRequests({ patientId }), groups: AdelanteEHR.groupsForPatient(patientId).map(g => ({ id: g.id, topic: g.topic, start: nextOccurrenceForGroup(g.id, now) })) }, now, lang);
}