// eRx / medication-management vendor adapter (eScribe target). The mock owns
// its own seed data so the surface can render before contracts are signed.

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  prescriber: string;
  startedOn: string;
  endedOn?: string;
  status: "active" | "discontinued";
  source: "escribe" | "manual";
}

export type RxEventKind = "sso_launch" | "refill_requested" | "discontinued";
export interface RxEvent {
  id: string;
  patientId: string;
  clinicianId?: string;
  kind: RxEventKind;
  at: string;
  note?: string;
}

export interface ErxAdapter {
  readonly vendorName: string;
  ssoLaunchUrl(clinicianId: string, patientId: string): string;
  listActiveMedications(patientId: string): Medication[];
  listRecentRx(patientId: string, limit?: number): Medication[];
  pushDemographics(patient: { id: string; firstName: string; lastName: string }): Promise<void>;
  ping(): Promise<{ ok: boolean; at: string }>;
}

const seedByPatient: Record<string, Medication[]> = {};
let seq = 0;
const mid = () => `med_${++seq}`;

function seedFor(patientId: string): Medication[] {
  if (seedByPatient[patientId]) return seedByPatient[patientId];
  // Deterministic tiny seed for the first mock patient so demos aren't empty.
  if (patientId.endsWith("1") || patientId.endsWith("a")) {
    seedByPatient[patientId] = [
      {
        id: mid(),
        patientId,
        name: "Sertraline",
        dose: "50 mg",
        route: "oral",
        frequency: "daily",
        prescriber: "Dr. Alvarez, PMHNP",
        startedOn: new Date(Date.now() - 30 * 864e5).toISOString(),
        status: "active",
        source: "escribe",
      },
    ];
  } else {
    seedByPatient[patientId] = [];
  }
  return seedByPatient[patientId];
}

export const MockEscribeAdapter: ErxAdapter = {
  vendorName: "escribe-mock",
  ssoLaunchUrl(clinicianId, patientId) {
    return `https://escribe.mock/sso?clinician=${clinicianId}&patient=${patientId}`;
  },
  listActiveMedications(patientId) {
    return seedFor(patientId).filter((m) => m.status === "active");
  },
  listRecentRx(patientId, limit = 10) {
    return [...seedFor(patientId)]
      .sort((a, b) => +new Date(b.startedOn) - +new Date(a.startedOn))
      .slice(0, limit);
  },
  async pushDemographics() {
    /* no-op in mock */
  },
  async ping() {
    return { ok: true, at: new Date().toISOString() };
  },
};
