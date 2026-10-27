// 27 Oct (Mitch) — "Getting started" projections. Draft — pending EHR/Admin audit.
// Read-only views of records that already exist; no new clinical store.
//  • Patient (and Adel): own care team names, next visit, paperwork, own
//    intake needs, pathway content, coverage in plain words, requested groups.
//  • Advocate: only what the consent-scoped advocate schedule already returns.
//  • Staff Today: caseload people still in stages 5–7, neutral labels only.
// No SUD/consent wording; Spanish uses tú and is draft.
import { AdelanteEHR, type Patient } from "./ehr";
import { getStaffMember, STAFF_ROSTER, type StaffRole } from "./roles";
import { patientCoverageSummary } from "./coverageRequests";
import { patientOwnPacketNeeds, NEED_LABEL } from "./intakePacket";
import { nextScheduledAppointment } from "./postEnrollment";
import { isJusticeInvolved } from "./justiceInvolvement";
import { lifecycleForPatient, type LifecycleView } from "./careLifecycle";

type L = "en" | "es";
export interface GettingStartedItem { id: string; label: string; detail?: string; done: boolean; needId?: string }

const T = {
  team: { en: "Your care team", es: "Tu equipo de atención" },
  cm: { en: "Care manager", es: "Coordinador(a) de atención" },
  clin: { en: "Clinician", es: "Profesional clínico" },
  notYet: { en: "We're choosing someone for you", es: "Estamos eligiendo a alguien para ti" },
  visit: { en: "Your first visit", es: "Tu primera cita" },
  noVisit: { en: "Not scheduled yet — your team will reach out", es: "Todavía no está programada — tu equipo te va a contactar" },
  paperwork: { en: "Paperwork", es: "Papeles" },
  paperDone: { en: "All done", es: "Todo listo" },
  paperOpen: { en: "A few forms are waiting for you", es: "Tienes algunos formularios pendientes" },
  pathway: { en: "Something to start with", es: "Algo para empezar" },
  firstDays: { en: "My First Days Out", es: "Mis primeros días afuera" },
  welcome: { en: "Welcome to Adelante", es: "Bienvenido(a) a Adelante" },
  group: { en: "Group", es: "Grupo" },
  requested: { en: "Requested — waiting for your team", es: "Pedido — esperando a tu equipo" },
};

function staffNameByClinician(id?: string) {
  if (!id) return undefined;
  return (STAFF_ROSTER.find((s) => s.clinicianId === id || s.id === id) ?? getStaffMember(id))?.name;
}

/** Shown from enrollment until the person reaches Stage 8 (or care is closed). */
export function showGettingStarted(p: Patient | undefined): boolean {
  if (!p?.enrolledAt) return false;
  const v = lifecycleForPatient(p);
  return !v.closed && v.stage < 8;
}

export function patientGettingStarted(patientId: string, lang: L): GettingStartedItem[] {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return [];
  const items: GettingStartedItem[] = [];
  const cm = getStaffMember(p.caseManagerId)?.name;
  const clin = staffNameByClinician(p.primaryClinicianId);
  items.push({ id: "team", label: T.team[lang], detail: `${T.cm[lang]}: ${cm ?? T.notYet[lang]} · ${T.clin[lang]}: ${clin ?? T.notYet[lang]}`, done: !!cm && !!clin });
  const next = nextScheduledAppointment(patientId);
  const attended = AdelanteEHR.appointmentsForPatient(patientId).some((a) => a.status === "attended");
  items.push({ id: "visit", label: T.visit[lang], detail: next ? new Date(next.start).toLocaleString(lang === "es" ? "es-US" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : attended ? undefined : T.noVisit[lang], done: attended });
  items.push({ id: "paperwork", label: T.paperwork[lang], detail: p.intakeCompletedAt ? T.paperDone[lang] : T.paperOpen[lang], done: !!p.intakeCompletedAt });
  for (const line of patientCoverageSummary(patientId, lang)) items.push({ id: `coverage-${line}`, label: line, done: /activa|active|pago propio|self-pay|lista|set up/i.test(line) });
  for (const n of patientOwnPacketNeeds(patientId)) {
    if (n.state === "resolved") continue;
    items.push({ id: `need-${n.id}`, label: NEED_LABEL[n.kind][lang], needId: n.id, done: false, detail: n.state === "confirmed_still_needed" ? (lang === "es" ? "Tu equipo lo sabe" : "Your team knows") : undefined });
  }
  items.push({ id: "pathway", label: T.pathway[lang], detail: isJusticeInvolved(p) ? T.firstDays[lang] : T.welcome[lang], done: false });
  for (const r of AdelanteEHR.listGroupJoinRequests({ patientId, status: "pending" })) {
    const g = AdelanteEHR.listGroupSessions().find((x) => x.id === r.sessionId);
    // A requested group stays "Requested" until the care team approves it.
    items.push({ id: `group-${r.id}`, label: `${T.group[lang]}: ${r.protected ? (lang === "es" ? "grupo de apoyo" : "support group") : (g?.topic ?? "")}`, detail: T.requested[lang], done: false });
  }
  return items;
}

/** Adel's one-line nudge — first open item only, neutral wording. */
export function adelGettingStartedLine(patientId: string, lang: L): string | undefined {
  const p = AdelanteEHR.getPatient(patientId);
  if (!showGettingStarted(p)) return undefined;
  const open = patientGettingStarted(patientId, lang).find((i) => !i.done);
  if (!open) return undefined;
  return lang === "es" ? `Para empezar: ${open.label}${open.detail ? ` — ${open.detail}` : ""}.` : `Getting started: ${open.label}${open.detail ? ` — ${open.detail}` : ""}.`;
}

/** Advocate slice — strictly the consent-scoped schedule; nothing else. */
export function advocateGettingStarted(linkId: string) {
  const s = AdelanteEHR.advocateSchedule(linkId);
  if (!s.allowed) return { allowed: false as const, items: [] };
  return { allowed: true as const, items: s.items.slice(0, 3).map((i) => ({ id: i.id, start: i.start, label: i.label })) };
}

/** Staff Today: my caseload people still in stages 5–7. */
export function staffGettingStarted(patients: Patient[], role: StaffRole): { patient: Patient; view: LifecycleView }[] {
  return patients
    .filter((p) => !!p.enrolledAt)
    .map((p) => ({ patient: p, view: lifecycleForPatient(p) }))
    .filter(({ view }) => !view.closed && view.stage >= 5 && view.stage <= 7 && view.ownerRoles.includes(role));
}
