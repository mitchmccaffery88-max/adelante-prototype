// Mock HIE (health information exchange) adapter. Like the eRx and telehealth
// mocks, this is the only seam that would talk to a real HIE / ADT feed.
// DEMO ONLY — "Simulated HIE feed — demo data, no live connection".
// Facility names are placeholders. Records are generated relative to `now`.

export type HieRecordKind = "ed_visit" | "admission" | "discharge" | "sud_program";

export interface HieFeedEncounter {
  feedId: string;
  patientFirstName: string;
  kind: HieRecordKind;
  at: string;
  facility: string;
  reason: string;
  dischargeDiagnosis?: string;
  /** 42 CFR Part 2-covered record (outside SUD program). */
  sud: boolean;
}

export interface HieFeedMedication {
  feedId: string;
  patientFirstName: string;
  name: string;
  sig: string;
  prescriber: string;
}

export interface HieFeed {
  encounters: HieFeedEncounter[];
  medications: HieFeedMedication[];
}

export interface HieAdapter {
  readonly vendorName: string;
  readonly mode: "simulated";
  fetchFeed(now?: Date): HieFeed;
}

const DAY = 86400000;
const ago = (now: Date, days: number, hour: number) => {
  const d = new Date(now.getTime() - days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const MockHieAdapter: HieAdapter = {
  vendorName: "adelante-simulated-hie",
  mode: "simulated",
  fetchFeed(now = new Date()) {
    return {
      encounters: [
        {
          feedId: "hie-daniel-ed-1",
          patientFirstName: "Daniel",
          kind: "ed_visit",
          at: ago(now, 1, 21),
          facility: "Valley Regional Medical Center (placeholder)",
          reason: "Chest tightness and panic; cardiac cause ruled out",
          dischargeDiagnosis: "F41.0 Panic disorder",
          sud: false,
        },
        {
          feedId: "hie-marcus-adm-1",
          patientFirstName: "Marcus",
          kind: "admission",
          at: ago(now, 2, 14),
          facility: "Kings General Hospital (placeholder)",
          reason: "Community-acquired pneumonia",
          sud: false,
        },
        {
          feedId: "hie-marcus-dc-1",
          patientFirstName: "Marcus",
          kind: "discharge",
          at: ago(now, 0, 9),
          facility: "Kings General Hospital (placeholder)",
          reason: "Discharged home after pneumonia treatment",
          dischargeDiagnosis: "J18.9 Pneumonia, unspecified organism",
          sud: false,
        },
        {
          feedId: "hie-marcus-sud-1",
          patientFirstName: "Marcus",
          kind: "sud_program",
          at: ago(now, 5, 10),
          facility: "Outside SUD program (placeholder)",
          reason: "Outpatient program visit",
          sud: true,
        },
      ],
      medications: [
        {
          feedId: "hie-daniel-med-1",
          patientFirstName: "Daniel",
          name: "Hydroxyzine 25 mg tablet",
          sig: "1 tablet by mouth every 6 hours as needed for anxiety",
          prescriber: "ED physician, Valley Regional (placeholder)",
        },
      ],
    };
  },
};
