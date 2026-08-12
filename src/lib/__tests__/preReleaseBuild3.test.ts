// §Pre-release build 3 — MAT ordering entry point + real appointment booking.
// The point of these tests is that NEITHER is a parallel tracking system: the
// MAT order is an ordinary MedOrder in the chart and the appointment is an
// ordinary Appointment in the scheduling store, both blocked by the Build-1
// capacity gate.
import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR, type CfAttribution } from "@/lib/ehr";
import { getStaffMember } from "@/lib/roles";

const CF = "s-cf1";
const cf = () => getStaffMember(CF)!;
const PRESCRIBER = { staffId: "s-np1", staffName: "Dr. R. Bagga", role: "pmhnp" as const };

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

function attribution(): CfAttribution {
  return { enteredBy: { staffId: cf().id, staffName: cf().name, role: "cf_care_manager" } };
}

function newEpisode(last: string, capacity: "competent" | "impaired" | null = "competent") {
  const r = AdelanteEHR.openPreReleaseEpisodeForNewPatient({
    firstName: "Build3",
    lastName: last,
    dob: "1988-02-02",
    anticipatedReleaseDate: "2026-12-01",
    cfCareManagerStaffId: cf().id,
    cfCareManagerName: cf().name,
    openedBy: cf().name,
    actorRole: "cf_care_manager",
  });
  opened.push(r.episode.id);
  if (capacity)
    AdelanteEHR.recordPreReleaseCapacity({
      episodeId: r.episode.id,
      status: capacity,
      basis:
        capacity === "competent"
          ? "Oriented, answered for themselves throughout."
          : "Cannot state the purpose of the interview.",
      attribution: attribution(),
    });
  return r;
}

const bupe = {
  drugName: "Buprenorphine 8 MG / Naloxone 2 MG Sublingual Film",
  productName: "Buprenorphine 8 MG / Naloxone 2 MG Sublingual Film",
  strengthText: "8 MG / 2 MG",
  route: "sublingual",
  createdBy: PRESCRIBER.staffName,
};

describe("MAT ordering entry point", () => {
  it("creates a real MedOrder on the chart through the ordinary order store", () => {
    const { patient, episode } = newEpisode("Mat");
    const order = AdelanteEHR.orderPreReleaseMat({
      episodeId: episode.id,
      prescriber: PRESCRIBER,
      order: bupe,
    });
    expect(order.status).toBe("draft");
    expect(order.preReleaseEpisodeId).toBe(episode.id);
    // Same list every other order surface reads.
    expect(AdelanteEHR.listOrders(patient.id).map((o) => o.id)).toContain(order.id);
    expect(AdelanteEHR.listPreReleaseMatOrders(episode.id).map((o) => o.id)).toEqual([order.id]);
  });

  it("reuses the real prescriber gate — non-prescribers cannot order", () => {
    const { episode } = newEpisode("Gate");
    expect(() =>
      AdelanteEHR.orderPreReleaseMat({
        episodeId: episode.id,
        prescriber: { staffId: cf().id, staffName: cf().name, role: "cf_care_manager" },
        order: bupe,
      }),
    ).toThrow(/prescriber/i);
  });

  it("is blocked by the Build-1 capacity gate when impaired with no authority", () => {
    const { episode } = newEpisode("Impaired", "impaired");
    expect(() =>
      AdelanteEHR.orderPreReleaseMat({
        episodeId: episode.id,
        prescriber: PRESCRIBER,
        order: bupe,
      }),
    ).toThrow();
  });

  it("signs through the ordinary signOrders path", () => {
    const { patient, episode } = newEpisode("Sign");
    const order = AdelanteEHR.orderPreReleaseMat({
      episodeId: episode.id,
      prescriber: PRESCRIBER,
      order: { ...bupe, sigOverride: "1 film SL daily", quantity: 30, refills: 0 },
    });
    const signed = AdelanteEHR.signPreReleaseMatOrders({
      episodeId: episode.id,
      orderIds: [order.id],
      prescriber: PRESCRIBER,
    });
    expect(signed).toHaveLength(1);
    expect(AdelanteEHR.listOrders(patient.id).find((o) => o.id === order.id)?.status).toBe("signed");
  });
});

describe("real appointment booking", () => {
  const clinicianFor = () => AdelanteEHR.cliniciansForService("therapy_individual")[0]!;

  it("creates a real Appointment and links it onto the care plan row", () => {
    const { patient, episode } = newEpisode("Appt");
    const clinician = clinicianFor();
    const start = new Date(Date.now() + 7 * 864e5).toISOString();
    const { appointment } = AdelanteEHR.bookPreReleaseAppointment({
      episodeId: episode.id,
      kind: "mental_health",
      clinicianId: clinician.id,
      start,
      modality: "video",
      attribution: attribution(),
    });
    // Ordinary appointment store — not a pre-release-only concept.
    expect(AdelanteEHR.listAppointments().map((a) => a.id)).toContain(appointment.id);
    expect(appointment.patientId).toBe(patient.id);
    const row = AdelanteEHR.getReentryCarePlan(episode.id)!.appointments.find(
      (a) => a.kind === "mental_health",
    )!;
    expect(row.apptId).toBe(appointment.id);
    expect(row.providerName).toBe(clinician.name);
  });

  it("is blocked by the Build-1 capacity gate when impaired with no authority", () => {
    const { episode } = newEpisode("ApptBlocked", "impaired");
    expect(() =>
      AdelanteEHR.bookPreReleaseAppointment({
        episodeId: episode.id,
        kind: "mental_health",
        clinicianId: clinicianFor().id,
        start: new Date(Date.now() + 7 * 864e5).toISOString(),
        attribution: attribution(),
      }),
    ).toThrow();
  });
});
