// @vitest-environment jsdom
//
// §Group C follow-up — the CHW block banner must show the EXACT reasonCode and
// reason text that the policy module actually recorded at block time. Every
// scenario below goes through the real claim hook
// (`AdelanteEHRExt.upsertClaimFromChwNote` -> `chwBillingDecision` ->
// `AdelanteEHR.recordCommunityBillingBlocked`); no audit rows are hand-written.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { NotesTab } from "@/components/clinical/RecordTabs";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { STAFF_ROSTER, setActingStaff, LPHA_SUPERVISOR_ROLES } from "@/lib/roles";
import { eligibleSupervisingProviders } from "@/lib/communityBilling";

const chw = () => STAFF_ROSTER.find((s) => s.role === "community_health_worker")!;
const lpha = () => eligibleSupervisingProviders()[0]!;
const nonLpha = () => STAFF_ROSTER.find((s) => !LPHA_SUPERVISOR_ROLES.includes(s.role))!;

/** One patient per scenario so exactly one banner can be on screen. */
function patientAt(index: number) {
  const p = AdelanteEHR.listPatients()[index];
  if (!p) throw new Error(`fixture: expected a patient at index ${index}`);
  return p;
}

let seq = 0;
function chwNote(patientId: string) {
  const note = AdelanteEHR.addProgressNote(patientId, {
    date: new Date().toISOString(),
    author: chw().name,
    sessionType: "individual",
    subjective: `chw visit ${++seq}`,
    templateKey: "chw_service",
  } as never) as { id: string } | undefined;
  if (!note) throw new Error("failed to create CHW note");
  return note;
}

function renderNotes(patientId: string) {
  localStorage.setItem("adelante.lang", "en");
  return render(
    <I18nProvider>
      <NotesTab patientId={patientId} restrictToTemplateKey="chw_service" />
    </I18nProvider>,
  );
}

/** The stored audit row — the single source of truth the banner must match. */
function storedBlock(patientId: string, noteId: string) {
  return AdelanteEHR.lastCommunityBillingBlock({
    patientId,
    service: "chw_services",
    noteId,
  });
}

function expectBannerMatchesStored(patientId: string, noteId: string, expectedCode: string) {
  const stored = storedBlock(patientId, noteId);
  expect(stored?.reasonCode).toBe(expectedCode);
  renderNotes(patientId);
  const codes = screen.getAllByTestId("chw-block-reason-code");
  expect(codes).toHaveLength(1);
  expect(codes[0]!.textContent).toBe(stored!.reasonCode);
  expect(screen.getByTestId("chw-block-reason").textContent).toBe(stored!.reason);
  return stored!;
}

beforeEach(() => setActingStaff(chw().id));
afterEach(cleanup);

describe("CHW block banner renders the real recorded reason", () => {
  it("no_supervising_provider — the CHW was asked and picked nobody", () => {
    const p = patientAt(0);
    const note = chwNote(p.id);
    expect(
      AdelanteEHRExt.upsertClaimFromChwNote({
        patientId: p.id, noteId: note.id, staffId: chw().id, clinicianId: "c1",
        dateISO: "2026-05-04T10:00:00.000Z", minutes: 30, supervisingStaffId: null,
      }),
    ).toBeNull();
    const stored = expectBannerMatchesStored(p.id, note.id, "no_supervising_provider");
    expect(stored.reason).toMatch(/enrolled LPHA-tier provider/i);
    // Not another reason's copy.
    expect(screen.queryByText(/enrolled in ECM/i)).toBeNull();
    expect(screen.queryByText(/Daily CHW limit/i)).toBeNull();
  });

  it("supervisor_not_lpha — the picked provider is off-tier", () => {
    const p = patientAt(1);
    const note = chwNote(p.id);
    expect(
      AdelanteEHRExt.upsertClaimFromChwNote({
        patientId: p.id, noteId: note.id, staffId: chw().id, clinicianId: "c1",
        dateISO: "2026-05-05T10:00:00.000Z", minutes: 30, supervisingStaffId: nonLpha().id,
      }),
    ).toBeNull();
    const stored = expectBannerMatchesStored(p.id, note.id, "supervisor_not_lpha");
    expect(stored.reason).toContain(nonLpha().name);
    expect(stored.reason).toMatch(/not an LPHA-tier supervisor/i);
  });

  it("ecm_concurrent — the member is inside an active ECM enrollment window", () => {
    const p = patientAt(2);
    const original = p.episodes ?? [];
    p.episodes = [
      ...original,
      {
        id: "ep-banner-ecm",
        type: "ecm",
        state: "active",
        openedAt: "2026-05-01",
        closedAt: "2026-05-31",
      },
    ];
    try {
      const note = chwNote(p.id);
      expect(
        AdelanteEHRExt.upsertClaimFromChwNote({
          patientId: p.id, noteId: note.id, staffId: chw().id, clinicianId: "c1",
          dateISO: "2026-05-10T10:00:00.000Z", minutes: 30, supervisingStaffId: lpha().id,
        }),
      ).toBeNull();
      const stored = expectBannerMatchesStored(p.id, note.id, "ecm_concurrent");
      expect(stored.reason).toContain("ep-banner-ecm");
      expect(stored.reason).toMatch(/cannot be billed concurrently with ECM/i);
    } finally {
      p.episodes = original.filter((e) => e.id !== "ep-banner-ecm");
    }
  });

  it("daily_unit_cap — the 4-unit / 2-hour day is already spent", () => {
    const p = patientAt(3);
    // Burn the whole day through a real, ALLOWED claim first.
    const filler = chwNote(p.id);
    expect(
      AdelanteEHRExt.upsertClaimFromChwNote({
        patientId: p.id, noteId: filler.id, staffId: chw().id, clinicianId: "c1",
        dateISO: "2026-05-12T09:00:00.000Z", minutes: 120, supervisingStaffId: lpha().id,
      }),
    ).toBeTruthy();
    const note = chwNote(p.id);
    expect(
      AdelanteEHRExt.upsertClaimFromChwNote({
        patientId: p.id, noteId: note.id, staffId: chw().id, clinicianId: "c1",
        dateISO: "2026-05-12T15:00:00.000Z", minutes: 30, supervisingStaffId: lpha().id,
      }),
    ).toBeNull();
    const stored = expectBannerMatchesStored(p.id, note.id, "daily_unit_cap");
    expect(stored.reason).toMatch(/Daily CHW limit reached/i);
  });

  it("no_service_time — a claim attempt with zero documented minutes", () => {
    const p = patientAt(4);
    const note = chwNote(p.id);
    expect(
      AdelanteEHRExt.upsertClaimFromChwNote({
        patientId: p.id, noteId: note.id, staffId: chw().id, clinicianId: "c1",
        dateISO: "2026-05-14T10:00:00.000Z", minutes: 0, supervisingStaffId: lpha().id,
      }),
    ).toBeNull();
    const stored = expectBannerMatchesStored(p.id, note.id, "no_service_time");
    expect(stored.reason).toMatch(/require documented service time/i);
  });
});

describe("negative case — no banner without a real stored block", () => {
  it("renders no banner for a note that was never blocked", () => {
    const p = patientAt(5);
    const note = chwNote(p.id);
    expect(storedBlock(p.id, note.id)).toBeUndefined();
    renderNotes(p.id);
    expect(screen.queryByTestId("chw-billing-block-banner")).toBeNull();
    expect(screen.queryByTestId("chw-block-reason-code")).toBeNull();
  });

  it("renders no banner after a successful (unblocked) claim", () => {
    const p = patientAt(5);
    const note = chwNote(p.id);
    expect(
      AdelanteEHRExt.upsertClaimFromChwNote({
        patientId: p.id, noteId: note.id, staffId: chw().id, clinicianId: "c1",
        dateISO: "2026-07-02T10:00:00.000Z", minutes: 30, supervisingStaffId: lpha().id,
      }),
    ).toBeTruthy();
    renderNotes(p.id);
    expect(screen.queryByTestId("chw-billing-block-banner")).toBeNull();
  });
});
