// §Pre-release build 4 — CalAIM care-plan reconciliation.
//
// The claim under test: work captured in the pre-release workspace (builds
// 1–3) shows up in the REAL CalAIM care plan the community care team reads
// everywhere else, live — and Part 2 content stays flagged sensitive so the
// care plan does not become a second, unprotected path into MAT data.
import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR, type CfAttribution } from "@/lib/ehr";
import { getStaffMember } from "@/lib/roles";

const cf = () => getStaffMember("s-cf1")!;
const PRESCRIBER = { staffId: "s-np1", staffName: "Dr. R. Bagga", role: "pmhnp" as const };
const attribution = (): CfAttribution => ({
  enteredBy: { staffId: cf().id, staffName: cf().name, role: "cf_care_manager" },
});

const opened: string[] = [];
afterEach(() => {
  for (const id of opened.splice(0)) {
    const ep = AdelanteEHR.getPreReleaseEpisode(id);
    if (ep && ep.status !== "closed")
      AdelanteEHR.closePreReleaseEpisode({
        episodeId: id,
        reason: "test teardown",
        closedBy: "test",
        actorRole: "cf_care_manager",
      });
  }
});

function newEpisode(last: string) {
  const r = AdelanteEHR.openPreReleaseEpisodeForNewPatient({
    firstName: "Build4",
    lastName: last,
    dob: "1990-05-05",
    anticipatedReleaseDate: "2026-12-01",
    cfCareManagerStaffId: cf().id,
    cfCareManagerName: cf().name,
    openedBy: cf().name,
    actorRole: "cf_care_manager",
  });
  opened.push(r.episode.id);
  AdelanteEHR.recordPreReleaseCapacity({
    episodeId: r.episode.id,
    status: "competent",
    basis: "Oriented, answered for themselves throughout.",
    attribution: attribution(),
  });
  return r;
}

describe("pre-release data feeds the real CalAIM care plan", () => {
  it("carries capacity, screenings, SDOH needs, appointments and MAT into the snapshot", () => {
    const { patient, episode } = newEpisode("Plan");

    // Build 2 — real AHC-HRSN with housing + food positive.
    AdelanteEHR.recordPreReleaseScreener({
      episodeId: episode.id,
      screenerKey: "ahc-hrsn",
      answers: [1, 0, 1, 0, 0, 0, 1, 1, 1, 1],
      attribution: attribution(),
    });

    // Build 3 — real appointment + real signed MAT order.
    const clinician = AdelanteEHR.cliniciansForService("therapy_individual")[0]!;
    AdelanteEHR.bookPreReleaseAppointment({
      episodeId: episode.id,
      kind: "mental_health",
      clinicianId: clinician.id,
      start: new Date(Date.now() + 7 * 864e5).toISOString(),
      modality: "video",
      attribution: attribution(),
    });
    const order = AdelanteEHR.orderPreReleaseMat({
      episodeId: episode.id,
      prescriber: PRESCRIBER,
      order: {
        drugName: "Buprenorphine 8 MG / Naloxone 2 MG Sublingual Film",
        productName: "Buprenorphine 8 MG / Naloxone 2 MG Sublingual Film",
        strengthText: "8 MG / 2 MG",
        route: "sublingual",
        sigOverride: "1 film SL daily",
        quantity: 30,
        createdBy: PRESCRIBER.staffName,
      },
    });
    AdelanteEHR.signPreReleaseMatOrders({
      episodeId: episode.id,
      orderIds: [order.id],
      prescriber: PRESCRIBER,
    });

    // The plan every other surface reads — no pre-release-specific call.
    const plan = AdelanteEHR.getCarePlan(patient.id);
    expect(plan).toBeTruthy();
    const pre = plan!.preRelease!;
    expect(pre.episodeId).toBe(episode.id);
    expect(pre.capacityState).toBe("self_consent");
    expect(pre.screeningsCaptured).toBeGreaterThan(0);
    expect(pre.appointments.map((a) => a.kind)).toContain("mental_health");
    expect(pre.matMedications.map((m) => m.name.toLowerCase()).join(" ")).toMatch(/buprenorphine/);

    // SDOH needs identified pre-release are open needs on the plan.
    const needs = plan!.sdohOpen.map((s) => s.need.toLowerCase()).join(" | ");
    expect(needs).toMatch(/housing/);
    expect(needs).toMatch(/food/);

    // MAT reaches the plan's medication slice AND stays flagged Part 2.
    const med = plan!.medications.find((m) => /buprenorphine/i.test(m.name));
    expect(med).toBeTruthy();
    expect(med!.sensitive).toBe(true);
    expect(med!.source).toBe("pre_release");
    expect(pre.sensitive).toBe(true);
  });

  it("stays live — a later booking is reflected without re-entry", () => {
    const { patient, episode } = newEpisode("Live");
    expect(AdelanteEHR.getCarePlan(patient.id)?.preRelease?.appointments).toHaveLength(0);
    const clinician = AdelanteEHR.cliniciansForService("therapy_individual")[0]!;
    AdelanteEHR.bookPreReleaseAppointment({
      episodeId: episode.id,
      kind: "med_management",
      clinicianId: clinician.id,
      start: new Date(Date.now() + 3 * 864e5).toISOString(),
      modality: "video",
      attribution: attribution(),
    });
    expect(AdelanteEHR.getCarePlan(patient.id)?.preRelease?.appointments).toHaveLength(1);
  });

  it("survives episode close — the plan follows the member into the community", () => {
    const { patient, episode } = newEpisode("Release");
    AdelanteEHR.closePreReleaseEpisode({
      episodeId: episode.id,
      reason: "released",
      closedBy: cf().name,
      actorRole: "cf_care_manager",
    });
    opened.length = 0;
    const pre = AdelanteEHR.getCarePlan(patient.id)?.preRelease;
    expect(pre?.episodeId).toBe(episode.id);
    expect(pre?.status).toBe("closed");
  });
});
