// HealthieService — single seam for all clinical-backend reads/writes.
// Today this is an in-memory mock; swap implementations to wire Healthie GraphQL.

export type ReferralStatus = "submitted" | "contacted" | "enrolled";
export type SessionStatus = "scheduled" | "attended" | "no_show" | "cancelled";
export type BillingStatus = "draft" | "submitted" | "paid" | "denied";

export interface Referral {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email?: string;
  releaseDate: string;
  referringAgency: string;
  referrerName: string;
  pendingCharges?: string;
  priorBhRecords?: string;
  status: ReferralStatus;
  createdAt: string;
  smsSentAt?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  releaseDate: string;
  enrolledAt: string;
  episodeDay: number; // day within 90-day window
  smsFallback: boolean;
  consents: { hipaa: boolean; part2Sud: boolean; signedAt?: string };
  screeners: Record<string, ScreenerResult | undefined>;
  needs: { housing: boolean; food: boolean; employment: boolean; transport: boolean };
  carePlanSummary: string;
}

export interface ScreenerResult {
  key: string;
  score: number;
  severity: string;
  completedAt: string;
}

export interface Clinician {
  id: string;
  name: string;
  credential: string;
  mediCalCredentialed: boolean;
  mediCalStatus: "active" | "pending" | "expired";
}

export interface Appointment {
  id: string;
  patientId: string;
  clinicianId: string;
  start: string; // ISO
  durationMin: number;
  status: SessionStatus;
  billingStatus: BillingStatus;
  videoUrl?: string;
}

// ---------- mock store ----------

const uid = () => Math.random().toString(36).slice(2, 10);

const clinicians: Clinician[] = [
  { id: "c1", name: "Dr. Marisol Reyes", credential: "LCSW", mediCalCredentialed: true, mediCalStatus: "active" },
  { id: "c2", name: "Dr. James Okafor", credential: "PsyD", mediCalCredentialed: true, mediCalStatus: "active" },
  { id: "c3", name: "Anita Brooks", credential: "LMFT", mediCalCredentialed: false, mediCalStatus: "pending" },
];

const patients: Patient[] = [
  {
    id: "p1",
    firstName: "Daniel",
    lastName: "M.",
    dob: "1989-04-12",
    phone: "+15595550101",
    releaseDate: "2026-05-10",
    enrolledAt: "2026-05-12",
    episodeDay: 23,
    smsFallback: true,
    consents: { hipaa: true, part2Sud: true, signedAt: "2026-05-12" },
    screeners: {
      "phq-9": { key: "phq-9", score: 14, severity: "Moderate", completedAt: "2026-05-12" },
      "gad-7": { key: "gad-7", score: 11, severity: "Moderate", completedAt: "2026-05-12" },
    },
    needs: { housing: true, food: false, employment: true, transport: true },
    carePlanSummary: "Weekly therapy with Dr. Reyes; housing navigator referral pending.",
  },
  {
    id: "p2",
    firstName: "Rosa",
    lastName: "T.",
    dob: "1995-09-03",
    phone: "+15595550102",
    releaseDate: "2026-05-22",
    enrolledAt: "2026-05-24",
    episodeDay: 11,
    smsFallback: false,
    consents: { hipaa: true, part2Sud: false },
    screeners: {
      "phq-9": { key: "phq-9", score: 8, severity: "Mild", completedAt: "2026-05-24" },
    },
    needs: { housing: false, food: true, employment: true, transport: false },
    carePlanSummary: "Biweekly check-ins; CalFresh enrollment in progress.",
  },
  {
    id: "p3",
    firstName: "Marcus",
    lastName: "L.",
    dob: "1978-12-30",
    phone: "+15595550103",
    releaseDate: "2026-04-02",
    enrolledAt: "2026-04-05",
    episodeDay: 60,
    smsFallback: false,
    consents: { hipaa: true, part2Sud: true, signedAt: "2026-04-05" },
    screeners: {
      "phq-9": { key: "phq-9", score: 18, severity: "Moderately Severe", completedAt: "2026-04-05" },
      "audit": { key: "audit", score: 16, severity: "High risk", completedAt: "2026-04-05" },
    },
    needs: { housing: true, food: true, employment: true, transport: true },
    carePlanSummary: "Co-occurring SUD + depression; weekly sessions + peer support.",
  },
];

const today = new Date();
const inHours = (h: number) => new Date(today.getTime() + h * 3600 * 1000).toISOString();
const ago = (h: number) => new Date(today.getTime() - h * 3600 * 1000).toISOString();

const appointments: Appointment[] = [
  { id: "a1", patientId: "p1", clinicianId: "c1", start: inHours(26), durationMin: 50, status: "scheduled", billingStatus: "draft" },
  { id: "a2", patientId: "p1", clinicianId: "c1", start: ago(72), durationMin: 50, status: "attended", billingStatus: "submitted" },
  { id: "a3", patientId: "p2", clinicianId: "c2", start: inHours(4), durationMin: 50, status: "scheduled", billingStatus: "draft" },
  { id: "a4", patientId: "p3", clinicianId: "c1", start: ago(48), durationMin: 50, status: "no_show", billingStatus: "draft" },
  { id: "a5", patientId: "p3", clinicianId: "c1", start: ago(240), durationMin: 50, status: "attended", billingStatus: "paid" },
  { id: "a6", patientId: "p2", clinicianId: "c2", start: ago(120), durationMin: 50, status: "attended", billingStatus: "denied" },
];

const referrals: Referral[] = [
  {
    id: "r1",
    firstName: "Daniel",
    lastName: "M.",
    dob: "1989-04-12",
    phone: "+15595550101",
    releaseDate: "2026-05-10",
    referringAgency: "Kings County Probation",
    referrerName: "Officer Hernandez",
    pendingCharges: "None",
    status: "enrolled",
    createdAt: ago(72 * 24),
    smsSentAt: ago(72 * 24 - 0.05),
  },
  {
    id: "r2",
    firstName: "Sasha",
    lastName: "K.",
    dob: "1992-02-18",
    phone: "+15595550110",
    releaseDate: "2026-06-01",
    referringAgency: "Drug Court",
    referrerName: "CM. Patel",
    status: "contacted",
    createdAt: ago(48),
    smsSentAt: ago(48 - 0.05),
  },
  {
    id: "r3",
    firstName: "Eli",
    lastName: "B.",
    dob: "1985-07-22",
    phone: "+15595550120",
    releaseDate: "2026-06-04",
    referringAgency: "Parole",
    referrerName: "Agent Yu",
    status: "submitted",
    createdAt: ago(2),
    smsSentAt: ago(2 - 0.05),
  },
];

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export const HealthieService = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  // Reads
  listReferrals: () => [...referrals].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  listPatients: () => patients,
  getPatient: (id: string) => patients.find((p) => p.id === id),
  listClinicians: () => clinicians,
  getClinician: (id: string) => clinicians.find((c) => c.id === id),
  listAppointments: () => [...appointments].sort((a, b) => +new Date(a.start) - +new Date(b.start)),
  appointmentsForPatient: (pid: string) => appointments.filter((a) => a.patientId === pid),
  appointmentsForClinician: (cid: string) => appointments.filter((a) => a.clinicianId === cid),

  // Writes (mocked — in production these become Healthie GraphQL mutations)
  createReferral(input: Omit<Referral, "id" | "status" | "createdAt" | "smsSentAt">) {
    const r: Referral = {
      ...input,
      id: uid(),
      status: "submitted",
      createdAt: new Date().toISOString(),
      smsSentAt: new Date().toISOString(), // Healthie webhook → Twilio in real impl
    };
    referrals.unshift(r);
    emit();
    return r;
  },
  advanceReferral(id: string) {
    const r = referrals.find((x) => x.id === id);
    if (!r) return;
    r.status = r.status === "submitted" ? "contacted" : r.status === "contacted" ? "enrolled" : r.status;
    emit();
  },
  bookAppointment(input: { patientId: string; clinicianId: string; start: string; durationMin: number }) {
    const a: Appointment = { ...input, id: uid(), status: "scheduled", billingStatus: "draft" };
    appointments.push(a);
    emit();
    return a;
  },
  updateAppointmentStatus(id: string, status: SessionStatus) {
    const a = appointments.find((x) => x.id === id);
    if (!a) return;
    a.status = status;
    if (status === "attended") a.billingStatus = "submitted";
    emit();
  },
  recordScreener(patientId: string, result: ScreenerResult) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.screeners[result.key] = result;
    emit();
  },

  // Analytics helpers
  stats() {
    const enrolled = patients.length;
    const completed = appointments.filter((a) => a.status === "attended").length;
    const total = appointments.filter((a) => a.status !== "scheduled").length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const intakeVelocityDays = 2.4; // mock: avg referral → first session
    const billing = {
      draft: appointments.filter((a) => a.billingStatus === "draft").length,
      submitted: appointments.filter((a) => a.billingStatus === "submitted").length,
      paid: appointments.filter((a) => a.billingStatus === "paid").length,
      denied: appointments.filter((a) => a.billingStatus === "denied").length,
    };
    return { enrolled, completionRate, intakeVelocityDays, billing };
  },
};

import { useSyncExternalStore } from "react";
export function useHealthie<T>(selector: () => T): T {
  return useSyncExternalStore(
    (cb) => HealthieService.subscribe(cb),
    selector,
    selector,
  );
}