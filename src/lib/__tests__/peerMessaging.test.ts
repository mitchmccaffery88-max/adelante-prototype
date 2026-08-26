import { describe, expect, it } from "vitest";
import { AdelanteEHR, MESSAGE_SUD_FLAG_ROLES } from "@/lib/ehr";
import { canAccess } from "@/lib/roles";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";

function newPatient() {
  return AdelanteEHR.createPatient({ firstName: "Peer", lastName: "Thread" } as never).id;
}

describe("peer specialist messaging", () => {
  it("peer_specialist has write access to patient messaging", () => {
    expect(canAccess("peer_specialist", "patient_messaging").level).toBe("write");
  });

  it("still cannot change Part 2 flags", () => {
    expect(MESSAGE_SUD_FLAG_ROLES).not.toContain("peer_specialist");
    const pid = newPatient();
    const m = AdelanteEHR.sendPatientMessage(pid, "hello")!;
    expect(AdelanteEHR.flagMessageAsSud(pid, m.id, "Andre Willis", "peer_specialist")).toBe(false);
  });

  it("routes through authorType 'staff' with a real role attribution", () => {
    const pid = newPatient();
    const reply = AdelanteEHR.sendStaffMessage(pid, "Andre Willis", "I'm here", "peer_specialist")!;
    expect(reply.authorType).toBe("staff");
    expect(reply.authorRole).toBe("peer_specialist");
    expect(reply.authorName).toBe("Andre Willis");
  });

  it("crisis language in this channel uses the same real mechanism", () => {
    const pid = newPatient();
    const sent = AdelanteEHR.sendPatientMessage(pid, "I want to kill myself")!;
    scanTextForCrisis(pid, sent.body, { surface: "a care-team message" });
    const open = AdelanteEHR.listCrisisEscalations(pid, { status: "open" });
    expect(open).toHaveLength(1);
    expect(open[0]!.triggerSource).toBe("message_pattern");
    expect(AdelanteEHR.listCareMessages(pid).at(-1)!.body).toBe("I want to kill myself");
  });
});

// §Standalone route items — /peer must be a VIEW of the one thread.
describe("/peer focused view", () => {
  it("filters the same thread instead of creating a second one", async () => {
    const { peerStrand } = await import("@/components/patient/PeerChatPage");
    const pid = newPatient();
    AdelanteEHR.sendPatientMessage(pid, "hi Andre");
    AdelanteEHR.sendStaffMessage(pid, "Andre Willis", "hey, I'm here", "peer_specialist");
    AdelanteEHR.sendStaffMessage(pid, "Dr. Bagga", "labs are back", "pmhnp");

    const all = AdelanteEHR.listCareMessages(pid);
    const strand = peerStrand(all);
    expect(all).toHaveLength(3);
    expect(strand.map((m) => m.body)).toEqual(["hi Andre", "hey, I'm here"]);
    // Every message in the focused view is a row of the SAME thread.
    expect(strand.every((m) => all.includes(m))).toBe(true);
  });
});
