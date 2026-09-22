// §Pre-release pipeline — roster CSV classification and the write path.
//
// The classification rules ARE the product here: a row that quietly becomes
// the wrong outcome is worse than a rejected row, so each outcome and each
// rejection reason is pinned.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { canImportPreReleaseRoster } from "@/lib/roles";
import {
  previewPreReleaseRoster,
  rosterCounts,
  preReleaseCsvTemplate,
  type KnownPatient,
} from "@/lib/preReleaseRoster";

const HEADER =
  "first_name,last_name,dob,anticipated_release_date,county_of_release,facility_name,booking_number,hrsn_housing,hrsn_food,hrsn_transportation,hrsn_utilities,hrsn_safety";
const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

describe("pre-release roster preview", () => {
  it("classifies an unknown person as a new record", () => {
    const p = previewPreReleaseRoster(`${HEADER}\nAda,Nobody,1990-01-01,${soon},Fresno,Jail,BK-1,yes,no,,,`, []);
    expect(p.fatal).toBeUndefined();
    expect(p.candidates).toHaveLength(1);
    expect(p.candidates[0]!.outcome).toBe("created");
    // Blank means "not screened", never "no".
    expect(p.candidates[0]!.hrsn.map((d) => d.key)).toEqual(["housing", "food"]);
    expect(p.candidates[0]!.county).toBe("Fresno");
    expect(p.candidates[0]!.bookingNumber).toBe("BK-1");
  });

  it("matches an existing patient on name + DOB, and skips an identical open episode", () => {
    const known: KnownPatient[] = [
      { id: "p1", firstName: "Ada", lastName: "Known", dob: "1990-01-01" },
      {
        id: "p2",
        firstName: "Bo",
        lastName: "Same",
        dob: "1985-05-05",
        openEpisode: { id: "e2", anticipatedReleaseDate: soon },
      },
    ];
    const csv = `${HEADER}\nada,known,1990-01-01,${soon},,,,,,,,\nBo,Same,1985-05-05,${soon},,,,,,,,`;
    const p = previewPreReleaseRoster(csv, known);
    expect(p.candidates[0]!.outcome).toBe("matched");
    expect(p.candidates[0]!.patientId).toBe("p1");
    expect(p.candidates[1]!.outcome).toBe("skipped");
  });

  it("rejects rows with a specific reason instead of dropping them", () => {
    const csv = [
      HEADER,
      `,Nolast,1990-01-01,${soon},,,,,,,,`,
      `A,B,,${soon},,,,,,,,`,
      `A,B,01/02/1990,${soon},,,,,,,,`,
      `A,C,1990-01-01,,,,,,,,,`,
      `A,D,1990-01-01,2010-01-01,,,,,,,,`,
      `A,E,1990-01-01,${soon},,,,maybe,,,,`,
      `A,F,1990-01-01,${soon},,,,,,,,`,
      `A,F,1990-01-01,${soon},,,,,,,,`,
    ].join("\n");
    const p = previewPreReleaseRoster(csv, []);
    const reasons = p.rejections.map((r) => r.reason);
    expect(reasons[0]).toMatch(/first and last name/i);
    expect(reasons[1]).toMatch(/date of birth is missing/i);
    expect(reasons[2]).toMatch(/YYYY-MM-DD/);
    expect(reasons[3]).toMatch(/release date is missing/i);
    expect(reasons[4]).toMatch(/past/i);
    expect(reasons[5]).toMatch(/yes, no, or left blank/i);
    expect(reasons[6]).toMatch(/appears earlier/i);
    expect(rosterCounts(p).rejected).toBe(7);
  });

  it("refuses a file with a bad header or no rows", () => {
    expect(previewPreReleaseRoster("name,dob\nx,y", []).fatal).toMatch(/missing/i);
    expect(previewPreReleaseRoster("", []).fatal).toMatch(/empty/i);
    expect(previewPreReleaseRoster(HEADER, []).fatal).toMatch(/no people/i);
  });

  it("ships a template that parses cleanly", () => {
    const p = previewPreReleaseRoster(preReleaseCsvTemplate(), []);
    expect(p.fatal).toBeUndefined();
    expect(p.rejections).toHaveLength(0);
    expect(p.candidates).toHaveLength(1);
  });
});

describe("imported roster write path", () => {
  it("opens an episode, carries the release date to the patient, and marks imported HRSN honestly", () => {
    const { patient, episode } = AdelanteEHR.openPreReleaseEpisodeForNewPatient({
      firstName: "Roster",
      lastName: "Import",
      dob: "1991-02-03",
      anticipatedReleaseDate: soon,
      cfCareManagerStaffId: "staff_cf_1",
      cfCareManagerName: "CF Manager",
      facilityName: "Partner County Jail",
      bookingNumber: "BK-9001",
      openedBy: "staff_cf_1",
      actorRole: "cf_care_manager",
    });
    expect(episode.facilityName).toBe("Partner County Jail");
    expect(episode.bookingNumber).toBe("BK-9001");
    expect(AdelanteEHR.getPatient(patient.id)?.releaseDate).toBe(soon);

    AdelanteEHR.setCountyOfRelease(patient.id, "Fresno");
    expect(AdelanteEHR.getPatient(patient.id)?.coverage?.countyOfRelease).toBe("Fresno");

    const res = AdelanteEHR.recordImportedHrsnDomains({
      episodeId: episode.id,
      domains: [
        { key: "housing", label: "Housing instability & quality", positive: true },
        { key: "food", label: "Food insecurity", positive: false },
      ],
      importedBy: "staff_cf_1",
      actorRole: "cf_care_manager",
    });
    // Partner-reported, never presented as an administered interview.
    expect(res?.provenance).toBe("imported_roster");
    expect(res?.responses).toBeUndefined();
    expect(res?.score).toBe(1);
  });

  it("updates an open episode's logistics without moving its status", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Update", lastName: "Me", dob: "1980-01-01" });
    const ep = AdelanteEHR.openPreReleaseEpisode({
      patientId: p.id,
      anticipatedReleaseDate: soon,
      cfCareManagerStaffId: "staff_cf_1",
      cfCareManagerName: "CF Manager",
      openedBy: "staff_cf_1",
      actorRole: "cf_care_manager",
    });
    const later = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    const updated = AdelanteEHR.updatePreReleaseEpisodeDetails({
      episodeId: ep.id,
      anticipatedReleaseDate: later,
      facilityName: "New Facility",
      updatedBy: "staff_cf_1",
      actorRole: "cf_care_manager",
    });
    expect(updated?.anticipatedReleaseDate).toBe(later);
    expect(updated?.facilityName).toBe("New Facility");
    expect(updated?.status).toBe("open");
  });
});

describe("roster import permission", () => {
  it("reaches internal staff who might receive the partner's email, and nobody else", () => {
    expect(canImportPreReleaseRoster("cf_care_manager")).toBe(true);
    expect(canImportPreReleaseRoster("ecm_provider")).toBe(true);
    expect(canImportPreReleaseRoster("clinical_coordinator")).toBe(true);
    expect(canImportPreReleaseRoster("sys_admin")).toBe(true);
    expect(canImportPreReleaseRoster("therapist")).toBe(false);
    expect(canImportPreReleaseRoster("peer_specialist")).toBe(false);
  });
});
