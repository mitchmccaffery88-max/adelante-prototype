// HealthieService — single seam for all clinical-backend reads/writes.
// Today this is an in-memory mock; swap implementations to wire Healthie GraphQL.

export type ReferralStatus = "submitted" | "contacted" | "enrolled";
export type SessionStatus = "scheduled" | "attended" | "no_show" | "cancelled";
export type BillingStatus = "draft" | "submitted" | "paid" | "denied";
export type CoverageStatus = "active" | "suspended" | "none_unsure" | "other";
export type ReferralSource =
  | "probation"
  | "parole"
  | "drug_court"
  | "correctional"
  | "self"
  | "other";

export type ContactChannel = "text" | "call" | "video";
export type BestTime = "morning" | "afternoon" | "evening";
export type PreferredLanguage = "en" | "es";

export interface ContactPrefs {
  channel: ContactChannel;
  bestTime: BestTime;
}
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Referral {
  id: string;
  firstName: string;
  lastName: string;
  dob?: string;
  phone?: string;
  email?: string;
  releaseDate?: string;
  /** CIN / Medi-Cal ID (9 characters). Optional — helps de-duplicate similar names. */
  cin?: string;
  referringAgency: string;
  referrerName: string;
  referrerEmail?: string;
  referrerPhone?: string;
  referralSource: ReferralSource;
  countyOfRelease?: string;
  consentToContact: boolean;
  status: ReferralStatus;
  createdAt: string;
  smsSentAt?: string;
  outreachTask?: "manual_call";
  // Set when advanceReferral → "enrolled" materializes a Patient row.
  enrolledPatientId?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email?: string;
  releaseDate: string;
  enrolledAt: string;
  episodeDay: number; // day within 90-day window
  smsFallback: boolean;
  consents: { hipaa: boolean; part2Sud: boolean; signedAt?: string };
  screeners: Record<string, ScreenerResult | undefined>;
  // Longitudinal screener trends (PHQ-9/GAD-7 at intake/30/60/90, AUDIT/DAST/PCL ad hoc)
  screenerHistory?: ScreenerResult[];
  needs: {
    housing: boolean;
    food: boolean;
    employment: boolean;
    transport: boolean;
    substanceUse?: boolean;
    benefits?: boolean;
    family?: boolean;
  };
  carePlanSummary: string;
  intakeCompletedAt?: string;
  // Medi-Cal eligibility & coverage (§4d)
  coverage?: {
    status: CoverageStatus;
    verified: "verified" | "pending" | "not_found";
    countyOfRelease?: string;
    jiReentryFlag?: boolean;
    ecmEligible?: boolean;
    otherPlanName?: string;
    communitySupports?: {
      housing?: boolean;
      food?: boolean;
      transport?: boolean;
    };
  };
  // Case Manager workspace
  caseManagerId?: string;
  checkIns?: CheckIn[];
  resourceReferrals?: ResourceReferral[];
  // Crisis flag from §4c (PHQ-9 item 9 > 0, etc.)
  crisisFlag?: { source: string; raisedAt: string };
  // Programmatic, de-identified ID for Admin views
  programId: string;
  // Clinician care plan (editable)
  goals?: Goal[];
  progressNotes?: ProgressNote[];
  // Per-purpose consent state (revocable) + append-only audit trail
  consentState?: {
    part2Sud: boolean;
    ecmShare: boolean;
    sms: boolean;
  };
  consentEvents?: ConsentEvent[];
  // Patient-facing re-screen tasks created from clinician/case-manager workspaces
  tasks?: PatientTask[];
  // P1 — profile / contact preferences captured at signup + intake "About you"
  preferredName?: string;
  pronouns?: string;
  preferredLanguage?: PreferredLanguage;
  contactPrefs?: ContactPrefs;
  emergencyContact?: EmergencyContact;
  address?: string;
  /** CIN / Medi-Cal ID (9 characters). Helps disambiguate similar names. */
  cin?: string;
  // Link back to the referral that enrolled this patient, if any.
  referralId?: string;
  // Appointment-related notifications (booked / rescheduled / cancelled).
  notifications?: ApptNotification[];
}

export interface ScreenerResult {
  key: string;
  score: number;
  severity: string;
  completedAt: string;
  timepoint?: "intake" | "day30" | "day60" | "day90" | "adhoc";
  crisisFlag?: boolean;
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

export interface CheckIn {
  id: string;
  date: string;
  modality: "video" | "phone" | "in_person" | "sms";
  attended: boolean;
  notes?: string;
  needsFlagged: { housing?: boolean; food?: boolean; employment?: boolean; transport?: boolean };
}

export interface ResourceReferral {
  id: string;
  category: "housing" | "food" | "employment" | "legal" | "benefits" | "transport";
  provider: string;
  status: "pending" | "accepted" | "completed";
  createdAt: string;
  // 42 CFR Part 2 guardrail — must be true to share SUD-identifying detail externally
  sudDisclosureConsent?: boolean;
}

export interface CaseManager {
  id: string;
  name: string;
  role: "case_manager" | "peer_support";
}

export interface Goal {
  id: string;
  text: string;
  status: "open" | "in_progress" | "done";
  createdAt: string;
}

export interface ProgressNote {
  id: string;
  appointmentId?: string;
  clinicianId: string;
  date: string;
  sessionType: "individual" | "group" | "phone" | "check_in";
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export type ConsentPurpose = "part2Sud" | "ecmShare" | "sms" | "hipaa";
export interface ConsentEvent {
  id: string;
  purpose: ConsentPurpose;
  action: "granted" | "revoked";
  at: string;
  actor: "patient" | "staff";
  note?: string;
}

export interface PatientTask {
  id: string;
  kind: "rescreen" | "enrollment_assist" | "reactivation";
  label: string;
  screenerKey?: string;
  createdAt: string;
  completedAt?: string;
}

export type ApptNotificationKind = "booked" | "rescheduled" | "cancelled" | "confirmed";
export type CommsChannel = "profile" | "sms" | "email";
export interface ApptNotification {
  id: string;
  apptId: string;
  kind: ApptNotificationKind;
  at: string;
  channels: CommsChannel[];
}

export interface AvailabilitySlot {
  start: string; // ISO
  durationMin: number;
  taken: boolean;
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
    programId: "ADL-2026-001",
    firstName: "Daniel",
    lastName: "M.",
    dob: "1989-04-12",
    phone: "+15595550101",
    email: "daniel.m@example.com",
    releaseDate: "2026-05-10",
    enrolledAt: "2026-05-12",
    episodeDay: 23,
    smsFallback: true,
    consents: { hipaa: true, part2Sud: true, signedAt: "2026-05-12" },
    screeners: {
      "phq-9": { key: "phq-9", score: 14, severity: "Moderate", completedAt: "2026-05-12" },
      "gad-7": { key: "gad-7", score: 11, severity: "Moderate", completedAt: "2026-05-12" },
    },
    needs: { housing: true, food: false, employment: true, transport: true, family: true },
    carePlanSummary: "Weekly therapy with Dr. Reyes; housing navigator referral pending.",
    intakeCompletedAt: "2026-05-12",
    coverage: {
      status: "active",
      verified: "verified",
      countyOfRelease: "Kings",
      jiReentryFlag: true,
      ecmEligible: true,
    },
    caseManagerId: "cm1",
    screenerHistory: [
      { key: "phq-9", score: 18, severity: "Moderately Severe", completedAt: "2026-05-12", timepoint: "intake" },
      { key: "phq-9", score: 14, severity: "Moderate", completedAt: "2026-06-11", timepoint: "day30" },
      { key: "gad-7", score: 13, severity: "Moderate", completedAt: "2026-05-12", timepoint: "intake" },
      { key: "gad-7", score: 11, severity: "Moderate", completedAt: "2026-06-11", timepoint: "day30" },
    ],
    goals: [
      { id: "g1", text: "Attend weekly therapy sessions", status: "in_progress", createdAt: "2026-05-12" },
      { id: "g2", text: "Secure stable housing within 60 days", status: "open", createdAt: "2026-05-12" },
      { id: "g3", text: "Reconnect with one supportive family member", status: "done", createdAt: "2026-05-12" },
    ],
    progressNotes: [
      {
        id: "n1",
        clinicianId: "c1",
        date: "2026-06-04",
        sessionType: "individual",
        subjective: "Daniel reports lower mood this week tied to housing stress.",
        objective: "Engaged, oriented x3. PHQ-9 14 (down from 18).",
        assessment: "Moderate depression, improving. Active housing stressor.",
        plan: "Continue weekly CBT; coordinate with housing navigator.",
      },
    ],
  },
  {
    id: "p2",
    programId: "ADL-2026-002",
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
    coverage: {
      status: "suspended",
      verified: "pending",
      countyOfRelease: "Kings",
      jiReentryFlag: true,
    },
    caseManagerId: "cm1",
  },
  {
    id: "p3",
    programId: "ADL-2026-003",
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
    needs: { housing: true, food: true, employment: true, transport: true, substanceUse: true, benefits: true },
    carePlanSummary: "Co-occurring SUD + depression; weekly sessions + peer support.",
    intakeCompletedAt: "2026-04-05",
    coverage: {
      status: "active",
      verified: "verified",
      countyOfRelease: "Kings",
      jiReentryFlag: true,
      ecmEligible: true,
    },
    caseManagerId: "cm2",
    screenerHistory: [
      { key: "phq-9", score: 22, severity: "Severe", completedAt: "2026-04-05", timepoint: "intake" },
      { key: "phq-9", score: 18, severity: "Moderately Severe", completedAt: "2026-05-05", timepoint: "day30" },
      { key: "phq-9", score: 14, severity: "Moderate", completedAt: "2026-06-04", timepoint: "day60" },
    ],
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
    referralSource: "probation",
    countyOfRelease: "Kings",
    consentToContact: true,
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
    referralSource: "drug_court",
    countyOfRelease: "Kings",
    consentToContact: true,
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
    referralSource: "parole",
    countyOfRelease: "Tulare",
    consentToContact: true,
    status: "submitted",
    createdAt: ago(2),
    smsSentAt: ago(2 - 0.05),
  },
];

const caseManagers: CaseManager[] = [
  { id: "cm1", name: "Lupita Sanchez, MSW", role: "case_manager" },
  { id: "cm2", name: "Trey Wilson", role: "peer_support" },
];

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

// Session: which patient is "logged in" for the demo. Defaults to a patient
// who has not yet completed intake so the first-time flow is visible.
let currentPatientId = "p2";

export const HealthieService = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getCurrentPatientId: () => currentPatientId,
  setCurrentPatientId(id: string) {
    currentPatientId = id;
    emit();
  },
  // P0 — create a new patient from signup. Minimal seed; intake fills the rest.
  createPatient(input: {
    firstName: string;
    lastName: string;
    dob?: string;
    phone?: string;
    preferredLanguage?: PreferredLanguage;
    referralId?: string;
  }): Patient {
    const id = uid();
    const seq = String(patients.length + 1).padStart(3, "0");
    const now = new Date().toISOString();
    const p: Patient = {
      id,
      programId: `ADL-${new Date().getFullYear()}-${seq}`,
      firstName: input.firstName,
      lastName: input.lastName,
      dob: input.dob ?? "",
      phone: input.phone ?? "",
      releaseDate: "",
      enrolledAt: now,
      episodeDay: 1,
      smsFallback: Boolean(input.phone),
      consents: { hipaa: false, part2Sud: false },
      screeners: {},
      needs: { housing: false, food: false, employment: false, transport: false },
      carePlanSummary: "Care plan will appear here after intake.",
      preferredLanguage: input.preferredLanguage,
      referralId: input.referralId,
    };
    patients.push(p);
    emit();
    return p;
  },
  // P1 — patch identity / contact-prefs fields.
  updateProfile(
    patientId: string,
    patch: Partial<
      Pick<
        Patient,
        | "firstName"
        | "lastName"
        | "preferredName"
        | "pronouns"
        | "preferredLanguage"
        | "phone"
        | "email"
        | "dob"
        | "releaseDate"
        | "contactPrefs"
        | "emergencyContact"
        | "address"
      >
    >,
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    Object.assign(p, patch);
    emit();
  },
  completeIntake(
    patientId: string,
    payload: {
      needs: Patient["needs"];
      hipaa: boolean;
      part2Sud: boolean;
    },
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const now = new Date().toISOString();
    p.needs = payload.needs;
    p.consents = { hipaa: payload.hipaa, part2Sud: payload.part2Sud, signedAt: now };
    p.intakeCompletedAt = now;
    emit();
  },
  // Reads
  listReferrals: () => [...referrals].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  listPatients: () => patients,
  getPatient: (id: string) => patients.find((p) => p.id === id),
  listClinicians: () => clinicians,
  getClinician: (id: string) => clinicians.find((c) => c.id === id),
  listCaseManagers: () => caseManagers,
  getCaseManager: (id?: string) => caseManagers.find((c) => c.id === id),
  patientsForCaseManager: (cmId: string) =>
    patients.filter((p) => p.caseManagerId === cmId),
  listAppointments: () => [...appointments].sort((a, b) => +new Date(a.start) - +new Date(b.start)),
  appointmentsForPatient: (pid: string) => appointments.filter((a) => a.patientId === pid),
  appointmentsForClinician: (cid: string) => appointments.filter((a) => a.clinicianId === cid),

  // Writes (mocked — in production these become Healthie GraphQL mutations)
  createReferral(
    input: Omit<Referral, "id" | "status" | "createdAt" | "smsSentAt" | "outreachTask"> & {
      requestManualOutreach?: boolean;
    },
  ) {
    const { requestManualOutreach, ...rest } = input;
    // Fallback: no phone, no contact consent, or referrer explicitly requested
    // manual outreach → skip the Twilio welcome-text trigger and queue a
    // manual-call task for the care team instead.
    const canSendSms =
      !requestManualOutreach && !!rest.phone && rest.consentToContact;
    const r: Referral = {
      ...rest,
      id: uid(),
      status: "submitted",
      createdAt: new Date().toISOString(),
      ...(canSendSms
        ? { smsSentAt: new Date().toISOString() } // Healthie webhook → Twilio in real impl
        : { outreachTask: "manual_call" as const }),
    };
    referrals.unshift(r);
    emit();
    return r;
  },
  advanceReferral(id: string) {
    const r = referrals.find((x) => x.id === id);
    if (!r) return;
    const nextStatus: ReferralStatus =
      r.status === "submitted" ? "contacted" : r.status === "contacted" ? "enrolled" : r.status;
    r.status = nextStatus;
    // P4 — materialize a Patient row the moment a referral flips to enrolled.
    if (nextStatus === "enrolled" && !r.enrolledPatientId) {
      const p = HealthieService.createPatient({
        firstName: r.firstName,
        lastName: r.lastName,
        dob: r.dob,
        phone: r.phone,
        referralId: r.id,
      });
      r.enrolledPatientId = p.id;
    }
    emit();
  },
  bookAppointment(input: { patientId: string; clinicianId: string; start: string; durationMin: number }) {
    // Validate against mock availability: reject if the slot is already taken.
    const conflict = appointments.some(
      (x) =>
        x.clinicianId === input.clinicianId &&
        x.status === "scheduled" &&
        new Date(x.start).getTime() === new Date(input.start).getTime(),
    );
    if (conflict) {
      throw new Error("That time was just taken. Please pick another slot.");
    }
    const a: Appointment = { ...input, id: uid(), status: "scheduled", billingStatus: "draft" };
    appointments.push(a);
    HealthieService.notifyAppointmentChange({
      patientId: a.patientId,
      apptId: a.id,
      kind: "booked",
    });
    emit();
    return a;
  },
  rescheduleAppointment(apptId: string, newStart: string) {
    const a = appointments.find((x) => x.id === apptId);
    if (!a) return;
    const conflict = appointments.some(
      (x) =>
        x.id !== apptId &&
        x.clinicianId === a.clinicianId &&
        x.status === "scheduled" &&
        new Date(x.start).getTime() === new Date(newStart).getTime(),
    );
    if (conflict) {
      throw new Error("That time was just taken. Please pick another slot.");
    }
    a.start = newStart;
    HealthieService.notifyAppointmentChange({
      patientId: a.patientId,
      apptId: a.id,
      kind: "rescheduled",
    });
    emit();
    return a;
  },
  // Mock Healthie `availabilities` query — seeded slots per clinician,
  // Mon–Fri, three slots/day (10:00, 13:00, 15:30), with `taken` reflecting
  // existing scheduled appointments.
  getClinicianAvailability(clinicianId: string, days = 14): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const hours = [10, 13, 15.5];
    // Per-clinician day offset so the three clinicians don't show identical
    // availability strips in the picker.
    const offset =
      clinicianId === "c1" ? 0 : clinicianId === "c2" ? 1 : 2;
    for (let d = 1; d <= days + 7; d++) {
      const day = new Date(base);
      day.setDate(base.getDate() + d);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;
      // Skip every Nth weekday per clinician to vary supply
      if ((d + offset) % 4 === 0) continue;
      for (const h of hours) {
        const slot = new Date(day);
        const hr = Math.floor(h);
        const min = (h - hr) * 60;
        slot.setHours(hr, min, 0, 0);
        if (slot.getTime() < Date.now()) continue;
        const iso = slot.toISOString();
        const taken = appointments.some(
          (x) =>
            x.clinicianId === clinicianId &&
            x.status === "scheduled" &&
            new Date(x.start).getTime() === slot.getTime(),
        );
        slots.push({ start: iso, durationMin: 50, taken });
      }
    }
    return slots;
  },
  notifyAppointmentChange(input: {
    patientId: string;
    apptId: string;
    kind: ApptNotificationKind;
  }) {
    const p = patients.find((x) => x.id === input.patientId);
    if (!p) return;
    const channels: CommsChannel[] = ["profile"];
    if (HealthieService.isSmsOn(p.id) && p.phone) channels.push("sms");
    if (p.email) channels.push("email");
    p.notifications = [
      {
        id: uid(),
        apptId: input.apptId,
        kind: input.kind,
        at: new Date().toISOString(),
        channels,
      },
      ...(p.notifications ?? []),
    ].slice(0, 20);
    emit();
  },
  latestNotificationForAppt(patientId: string, apptId: string): ApptNotification | undefined {
    const p = patients.find((x) => x.id === patientId);
    return p?.notifications?.find((n) => n.apptId === apptId);
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
    p.screenerHistory = [...(p.screenerHistory ?? []), result];
    if (result.crisisFlag) {
      p.crisisFlag = { source: result.key, raisedAt: result.completedAt };
    }
    emit();
  },
  raiseCrisisFlag(patientId: string, source: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.crisisFlag = { source, raisedAt: new Date().toISOString() };
    emit();
  },
  setCoverage(patientId: string, coverage: NonNullable<Patient["coverage"]>) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.coverage = coverage;
    emit();
  },
  addCheckIn(patientId: string, checkIn: Omit<CheckIn, "id">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.checkIns = [{ ...checkIn, id: uid() }, ...(p.checkIns ?? [])];
    emit();
  },
  addResourceReferral(patientId: string, r: Omit<ResourceReferral, "id" | "createdAt" | "status">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.resourceReferrals = [
      { ...r, id: uid(), createdAt: new Date().toISOString(), status: "pending" },
      ...(p.resourceReferrals ?? []),
    ];
    emit();
  },
  updateCarePlanSummary(patientId: string, summary: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.carePlanSummary = summary;
    emit();
  },
  addGoal(patientId: string, text: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p || !text.trim()) return;
    p.goals = [
      ...(p.goals ?? []),
      { id: uid(), text: text.trim(), status: "open", createdAt: new Date().toISOString() },
    ];
    emit();
  },
  setGoalStatus(patientId: string, goalId: string, status: Goal["status"]) {
    const p = patients.find((x) => x.id === patientId);
    const g = p?.goals?.find((x) => x.id === goalId);
    if (!g) return;
    g.status = status;
    emit();
  },
  removeGoal(patientId: string, goalId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.goals) return;
    p.goals = p.goals.filter((g) => g.id !== goalId);
    emit();
  },
  addProgressNote(patientId: string, note: Omit<ProgressNote, "id">) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.progressNotes = [{ ...note, id: uid() }, ...(p.progressNotes ?? [])];
    emit();
  },

  // ----- Consent state + audit log -----
  getConsentState(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return { part2Sud: false, ecmShare: false, sms: true };
    return p.consentState ?? {
      part2Sud: p.consents.part2Sud,
      ecmShare: Boolean(p.coverage?.ecmEligible),
      sms: p.smsFallback,
    };
  },
  setConsent(patientId: string, purpose: ConsentPurpose, granted: boolean, note?: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const prev = p.consentState ?? {
      part2Sud: p.consents.part2Sud,
      ecmShare: Boolean(p.coverage?.ecmEligible),
      sms: p.smsFallback,
    };
    if (purpose !== "hipaa") {
      p.consentState = { ...prev, [purpose]: granted } as Patient["consentState"];
    }
    if (purpose === "part2Sud") p.consents.part2Sud = granted;
    if (purpose === "sms") p.smsFallback = granted;
    p.consentEvents = [
      ...(p.consentEvents ?? []),
      {
        id: uid(),
        purpose,
        action: granted ? "granted" : "revoked",
        at: new Date().toISOString(),
        actor: "patient",
        note,
      },
    ];
    emit();
  },
  listAllConsentEvents() {
    return patients
      .flatMap((p) =>
        (p.consentEvents ?? []).map((e) => ({ ...e, programId: p.programId })),
      )
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  },

  // Single source of truth for "is SMS reminders / fallback active?"
  // Reads revocable consent first; falls back to legacy patient.smsFallback.
  isSmsOn(patientId: string): boolean {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return false;
    return p.consentState?.sms ?? p.smsFallback;
  },

  // ----- ECM / Community Supports flags -----
  setEcmEligible(patientId: string, eligible: boolean) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.coverage = { ...(p.coverage ?? { status: "none_unsure", verified: "not_found" }), ecmEligible: eligible };
    emit();
  },
  setCommunitySupport(
    patientId: string,
    key: "housing" | "food" | "transport",
    on: boolean,
  ) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const base = p.coverage ?? { status: "none_unsure" as CoverageStatus, verified: "not_found" as const };
    p.coverage = {
      ...base,
      communitySupports: { ...(base.communitySupports ?? {}), [key]: on },
    };
    emit();
  },
  setJiReentry(patientId: string, on: boolean) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    const base = p.coverage ?? { status: "none_unsure" as CoverageStatus, verified: "not_found" as const };
    p.coverage = { ...base, jiReentryFlag: on };
    emit();
  },
  markCoverageVerified(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p?.coverage) return;
    p.coverage = { ...p.coverage, verified: "verified", status: "active" };
    emit();
  },
  requestReactivation(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.tasks = [
      {
        id: uid(),
        kind: "reactivation",
        label: "Medi-Cal reactivation requested with county",
        createdAt: new Date().toISOString(),
      },
      ...(p.tasks ?? []),
    ];
    if (p.coverage) p.coverage = { ...p.coverage, verified: "pending" };
    emit();
  },
  addEnrollmentAssistTask(patientId: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.tasks = [
      {
        id: uid(),
        kind: "enrollment_assist",
        label: "Case manager will help with BenefitsCal enrollment",
        createdAt: new Date().toISOString(),
      },
      ...(p.tasks ?? []),
    ];
    emit();
  },

  // ----- Re-screening cadence -----
  // Returns screener keys due for re-screening based on day 30/60/90 cadence.
  rescreensDue(patientId: string): { key: string; lastDays: number | null; nextDue: 30 | 60 | 90 }[] {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return [];
    const keys = ["phq-9", "gad-7", "audit", "dast-10", "pcl-5"];
    const out: { key: string; lastDays: number | null; nextDue: 30 | 60 | 90 }[] = [];
    const now = Date.now();
    for (const key of keys) {
      const history = (p.screenerHistory ?? []).filter((h) => h.key === key);
      if (history.length === 0) continue;
      const last = history.reduce((acc, h) =>
        +new Date(h.completedAt) > +new Date(acc.completedAt) ? h : acc,
      );
      const days = Math.floor((now - +new Date(last.completedAt)) / (1000 * 60 * 60 * 24));
      const intervals: (30 | 60 | 90)[] = [30, 60, 90];
      const due = intervals.find((d) => days >= d);
      if (due) out.push({ key, lastDays: days, nextDue: due });
    }
    return out;
  },
  sendRescreenTask(patientId: string, key: string) {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    p.tasks = [
      {
        id: uid(),
        kind: "rescreen",
        label: `Re-screen requested: ${key.toUpperCase()}`,
        screenerKey: key,
        createdAt: new Date().toISOString(),
      },
      ...(p.tasks ?? []),
    ];
    emit();
  },
  completeTask(patientId: string, taskId: string) {
    const p = patients.find((x) => x.id === patientId);
    const t = p?.tasks?.find((x) => x.id === taskId);
    if (!t) return;
    t.completedAt = new Date().toISOString();
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
  // Subscribe to a stable version number so we don't loop on new-array snapshots.
  useSyncExternalStore(
    (cb) => HealthieService.subscribe(cb),
    () => version,
    () => version,
  );
  return selector();
}