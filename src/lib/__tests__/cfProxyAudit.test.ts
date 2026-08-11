// §Quality pass Group B — proxy-mode entries must be AUDITED, not merely
// attributed. Attribution lives on the record and answers "whose work is
// this?"; an audit event lives in the immutable stream and answers "who did
// what, when, on whose behalf?". Before this pass the pre-release forms had
// the first and only half of the second (same action string as a direct
// entry, CF Care Manager's name but not id), and the Reentry Care Plan had
// neither audit half at all.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, type CfAttribution } from "@/lib/ehr";
import { getStaffMember } from "@/lib/roles";
import { resolveEpisodeEntry } from "@/lib/reentry";

const DIRECT_CF = "s-cf1"; // Rosa Delgado — a platform user, keys her own work
const PROXY_CF = "s-cf2"; // Darnell Pope — facility contract, not a platform user
const ECM = "s-cm1"; // Luz Herrera, ECM Provider

let auditFloor = "";
beforeEach(() => {
  auditFloor = new Date().toISOString();
});

afterEach(() => {
  for (const pid of ["p1", "p2", "p3"]) {
    const ep = AdelanteEHR.activePreReleaseEpisode(pid);
    if (ep)
      AdelanteEHR.closePreReleaseEpisode({
        episodeId: ep.id,
        reason: "test teardown",
        closedBy: "test",
        actorRole: "cf_care_manager",
      });
  }
});

function openEpisode(patientId: string, cfStaffId: string) {
  const cf = getStaffMember(cfStaffId)!;
  return AdelanteEHR.openPreReleaseEpisode({
    patientId,
    anticipatedReleaseDate: "2026-09-01",
    cfCareManagerStaffId: cf.id,
    cfCareManagerName: cf.name,
    openedBy: "test",
    actorRole: "cf_care_manager",
  });
}

/** Resolve the entry exactly the way the route does. */
function entry(actorStaffId: string, episodeCfStaffId: string) {
  const actor = getStaffMember(actorStaffId)!;
  return resolveEpisodeEntry({
    actorStaffId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    episodeCfStaffId,
  });
}

const events = () =>
  AdelanteEHR.listAuditEvents({ since: auditFloor }).filter((e) =>
    String(e.action).startsWith("pre_release_form") ||
    String(e.action).startsWith("reentry_care_plan") ||
    e.action === "cf_proxy_entry_denied",
  );

const saveForm = (episodeId: string, attribution: CfAttribution) =>
  AdelanteEHR.savePreReleaseForm({
    episodeId,
    formKey: "ssapp",
    values: { applicantName: "Test Member" },
    complete: false,
    attribution,
  });

const savePlan = (episodeId: string, attribution: CfAttribution) =>
  AdelanteEHR.saveReentryCarePlan({
    episodeId,
    housing: { arrangement: "Transitional housing" },
    appointments: [],
    attribution,
  });

describe("proxy-mode entry resolution", () => {
  it("treats the owning CF Care Manager's own entry as direct, with no attributedTo", () => {
    const ep = openEpisode("p1", DIRECT_CF);
    const r = entry(DIRECT_CF, ep.cfCareManagerStaffId);
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("direct");
    expect(r.attribution?.attributedTo).toBeUndefined();
  });

  it("refuses an ECM Provider on a DIRECT-mode CF Care Manager's episode", () => {
    const ep = openEpisode("p1", DIRECT_CF);
    const r = entry(ECM, ep.cfCareManagerStaffId);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/directly/i);
  });

  it("allows the same ECM Provider on a PROXY-mode CF Care Manager's episode", () => {
    const ep = openEpisode("p1", PROXY_CF);
    const r = entry(ECM, ep.cfCareManagerStaffId);
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("proxy");
    expect(r.attribution?.enteredBy.staffId).toBe(ECM);
    expect(r.attribution?.attributedTo?.staffId).toBe(PROXY_CF);
  });
});

describe("audit events carry both identities and distinguish the mode", () => {
  it("form save: proxy entry is a distinct action naming actor AND CF Care Manager", () => {
    const ep = openEpisode("p1", PROXY_CF);
    saveForm(ep.id, entry(ECM, ep.cfCareManagerStaffId).attribution!);
    const ev = events().find((e) => e.action === "pre_release_form_saved_proxy");
    expect(ev).toBeDefined();
    expect(ev!.detail).toMatchObject({
      entryMode: "proxy",
      proxyEntry: true,
      enteredByStaffId: ECM,
      enteredByStaffName: "Luz Herrera",
      enteredByRole: "ecm_provider",
      onBehalfOfStaffId: PROXY_CF,
    });
  });

  it("form save: a direct entry is distinguishable and names no one else", () => {
    const ep = openEpisode("p2", DIRECT_CF);
    saveForm(ep.id, entry(DIRECT_CF, ep.cfCareManagerStaffId).attribution!);
    const ev = events().find((e) => e.action === "pre_release_form_saved");
    expect(ev).toBeDefined();
    expect(events().some((e) => e.action.endsWith("_proxy"))).toBe(false);
    expect(ev!.detail).toMatchObject({ entryMode: "direct", proxyEntry: false });
    expect((ev!.detail as Record<string, unknown>)["onBehalfOfStaffId"]).toBeUndefined();
  });

  it("care plan: proxy save is audited at all — previously it was not", () => {
    const ep = openEpisode("p3", PROXY_CF);
    savePlan(ep.id, entry(ECM, ep.cfCareManagerStaffId).attribution!);
    const ev = events().find((e) => e.action === "reentry_care_plan_saved_proxy");
    expect(ev).toBeDefined();
    expect(ev!.detail).toMatchObject({
      entryMode: "proxy",
      enteredByStaffId: ECM,
      onBehalfOfStaffId: PROXY_CF,
    });
    // Section shape only — no member housing/pharmacy values in the log.
    expect(JSON.stringify(ev!.detail)).not.toContain("Transitional housing");
  });

  it("care plan: direct save is audited under the non-proxy action", () => {
    const ep = openEpisode("p3", DIRECT_CF);
    savePlan(ep.id, entry(DIRECT_CF, ep.cfCareManagerStaffId).attribution!);
    expect(events().some((e) => e.action === "reentry_care_plan_saved")).toBe(true);
  });
});

describe("data-layer backstop", () => {
  it("refuses a hand-rolled self-attributed write on someone else's episode, and audits the denial", () => {
    const ep = openEpisode("p1", DIRECT_CF);
    const forged: CfAttribution = {
      enteredBy: { staffId: ECM, staffName: "Luz Herrera", role: "ecm_provider" },
    };
    expect(() => saveForm(ep.id, forged)).toThrow(/Rosa Delgado owns this pre-release episode/);
    expect(() => savePlan(ep.id, forged)).toThrow(/owns this pre-release episode/);
    const denials = events().filter((e) => e.action === "cf_proxy_entry_denied");
    expect(denials).toHaveLength(2);
    expect(denials[0]!.detail).toMatchObject({
      enteredByStaffId: ECM,
      episodeCfStaffId: DIRECT_CF,
      reason: "not_owner_and_not_proxied",
    });
  });
});

// §Option A — capacity determination is an ordinary pre-release entry: same
// authorization check, same audit shape, no special case.
describe("capacity determination uses the identical proxy-attribution path", () => {
  const recordCapacity = (episodeId: string, attribution: CfAttribution) =>
    AdelanteEHR.recordPreReleaseCapacity({
      episodeId,
      status: "competent",
      basis: "Oriented and answering for themselves.",
      attribution,
    });

  it("attributes an ECM Provider's determination on a proxy-mode CF episode as a proxy entry", () => {
    const ep = openEpisode("p1", PROXY_CF);
    const rec = recordCapacity(ep.id, entry(ECM, ep.cfCareManagerStaffId).attribution!);
    expect(rec.attribution.enteredBy.staffId).toBe(ECM);
    expect(rec.attribution.attributedTo?.staffId).toBe(PROXY_CF);
    const ev = AdelanteEHR.listAuditEvents({ since: auditFloor }).find(
      (e) => e.action === "pre_release_capacity_determined_proxy",
    );
    expect(ev).toBeDefined();
    expect(ev!.detail).toMatchObject({
      entryMode: "proxy",
      proxyEntry: true,
      enteredByStaffId: ECM,
      enteredByRole: "ecm_provider",
      onBehalfOfStaffId: PROXY_CF,
    });
  });

  it("keeps the owner's own determination a plain direct entry", () => {
    const ep = openEpisode("p2", DIRECT_CF);
    const rec = recordCapacity(ep.id, entry(DIRECT_CF, ep.cfCareManagerStaffId).attribution!);
    expect(rec.attribution.attributedTo).toBeUndefined();
    const ev = AdelanteEHR.listAuditEvents({ since: auditFloor }).find(
      (e) => e.action === "pre_release_capacity_determined",
    );
    expect(ev!.detail).toMatchObject({ entryMode: "direct", proxyEntry: false });
  });

  it("refuses a self-attributed determination on someone else's episode, and audits the denial", () => {
    const ep = openEpisode("p3", DIRECT_CF);
    const forged: CfAttribution = {
      enteredBy: { staffId: ECM, staffName: "Luz Herrera", role: "ecm_provider" },
    };
    expect(() => recordCapacity(ep.id, forged)).toThrow(/owns this pre-release episode/);
    const denial = AdelanteEHR.listAuditEvents({ since: auditFloor }).find(
      (e) => e.action === "cf_proxy_entry_denied" && (e.detail as Record<string, unknown>)["target"] === "pre_release_capacity",
    );
    expect(denial).toBeDefined();
    expect(denial!.detail).toMatchObject({ reason: "not_owner_and_not_proxied" });
  });
});
