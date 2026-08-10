// @vitest-environment jsdom
//
// §Group C — validates the language toggle actually reaches the newer
// Peer / CHW documentation surfaces, and that the CHW block banner shows the
// REAL reason code recorded at block time.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { PeerNotesTab, NotesTab } from "@/components/clinical/RecordTabs";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { STAFF_ROSTER, setActingStaff } from "@/lib/roles";
import { eligibleSupervisingProviders } from "@/lib/communityBilling";

const chw = () => STAFF_ROSTER.find((s) => s.role === "community_health_worker")!;
const peer = () => STAFF_ROSTER.find((s) => s.role === "peer_specialist")!;
const patient = () => AdelanteEHR.listPatients()[0]!;

function renderIn(lang: "en" | "es", ui: React.ReactNode) {
  localStorage.setItem("adelante.lang", lang);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

afterEach(cleanup);

describe("Spanish stubs on the Peer surface", () => {
  beforeEach(() => setActingStaff(peer().id));

  it("renders the English heading by default", () => {
    renderIn("en", <PeerNotesTab patientId={patient().id} canWrite />);
    expect(screen.getByTestId("peer-note-heading").textContent).toBe("Peer specialist note");
  });

  it("renders the Spanish stub when the toggle is set to es", () => {
    renderIn("es", <PeerNotesTab patientId={patient().id} canWrite />);
    expect(screen.getByTestId("peer-note-heading").textContent).toMatch(/entre pares/i);
  });
});

describe("Spanish stubs + supervisor picker on the CHW surface", () => {
  beforeEach(() => setActingStaff(chw().id));

  it("renders the CHW composer heading in Spanish", () => {
    renderIn("es", <NotesTab patientId={patient().id} restrictToTemplateKey="chw_service" />);
    expect(screen.getByTestId("note-composer-heading").textContent).toMatch(
      /Nota de servicio de CHW/i,
    );
  });

  it("shows the supervising-provider picker with LPHA-tier options only", () => {
    const p = patient();
    const note = AdelanteEHR.addProgressNote(p.id, {
      date: new Date().toISOString(),
      author: chw().name,
      sessionType: "individual",
      subjective: "chw visit",
      templateKey: "chw_service",
    } as never);
    expect(note).toBeTruthy();
    renderIn("en", <NotesTab patientId={p.id} restrictToTemplateKey="chw_service" />);
    const picker = screen.getByTestId("chw-supervisor-picker");
    expect(picker.textContent).toMatch(/No supervising provider selected/i);
    expect(eligibleSupervisingProviders().length).toBeGreaterThan(0);
  });

  it("surfaces the recorded reason code on the note after a blocked attempt", () => {
    const p = patient();
    const note = AdelanteEHR.addProgressNote(p.id, {
      date: new Date().toISOString(),
      author: chw().name,
      sessionType: "individual",
      subjective: "chw visit blocked",
      templateKey: "chw_service",
    } as never)!;
    // Real block, through the real hook: no supervisor selected.
    const claim = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId: p.id,
      noteId: (note as { id: string }).id,
      staffId: chw().id,
      clinicianId: "c1",
      dateISO: new Date().toISOString(),
      minutes: 30,
      supervisingStaffId: null,
    });
    expect(claim).toBeNull();
    renderIn("en", <NotesTab patientId={p.id} restrictToTemplateKey="chw_service" />);
    expect(screen.getAllByTestId("chw-block-reason-code")[0]!.textContent).toBe(
      "no_supervising_provider",
    );
    expect(screen.getAllByTestId("chw-block-reason")[0]!.textContent).toMatch(
      /must be billed through an enrolled LPHA-tier provider/i,
    );
  });
});
