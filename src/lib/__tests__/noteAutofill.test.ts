// §Clinical documentation Phase 3b — autofill + orders-in-notes.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type Allergy, type MedOrder, type Problem } from "@/lib/ehr";
import { PART2_AUTOFILL_NOTICE, resolveAutofill, type AutofillContext } from "@/lib/noteAutofill";
import { draftOrderFromQuickPick, validateOrder } from "@/lib/orders";
import { findMissingRequired, type TemplateSection, type TemplateSchema } from "@/lib/templateSchema";

const NOW = new Date("2026-03-10T12:00:00.000Z");

function order(over: Partial<MedOrder> = {}): MedOrder {
  return {
    id: over.id ?? "o1",
    patientId: "p1",
    drugName: "Sertraline",
    dose: "50 mg",
    route: "PO",
    frequencyCode: "QAM",
    frequency: "Once daily",
    status: "signed",
    ...over,
  } as MedOrder;
}

function ctx(over: Partial<AutofillContext> = {}): AutofillContext {
  return {
    now: NOW,
    orders: [],
    allergies: [],
    problems: [],
    administrations: [],
    notes: [],
    sudLocked: false,
    ...over,
  };
}

function section(autofill: TemplateSection["autofill"]): TemplateSection {
  return { id: "a1", title: "Autofill", type: "autofill_section", fields: [], autofill };
}

describe("autofill — medications_active", () => {
  it("lists active orders and honours includePrn", () => {
    const c = ctx({
      orders: [
        order({ id: "o1" }),
        order({ id: "o2", drugName: "Ibuprofen", frequencyCode: "Q6H_PRN" }),
        order({ id: "o3", drugName: "Old med", status: "discontinued" }),
      ],
    });
    const all = resolveAutofill(section({ source: "medications_active" }), c);
    expect(all.lines.map((l) => l.primary)).toEqual(["Sertraline", "Ibuprofen"]);

    const noPrn = resolveAutofill(
      section({ source: "medications_active", includePrn: false }),
      c,
    );
    expect(noPrn.lines.map((l) => l.primary)).toEqual(["Sertraline"]);
  });

  it("respects the row limit and reports an empty list", () => {
    const c = ctx({ orders: [order({ id: "o1" }), order({ id: "o2", drugName: "B" })] });
    expect(resolveAutofill(section({ source: "medications_active", limit: 1 }), c).lines).toHaveLength(1);
    expect(resolveAutofill(section({ source: "medications_active" }), ctx()).notice).toBe(
      "Nothing on file.",
    );
  });
});

describe("autofill — SUD masking", () => {
  const problems = [
    { id: "pr1", description: "Hypertension", status: "active" },
    { id: "pr2", description: "Opioid use disorder", status: "active", category: "sud" },
  ] as Problem[];

  it("includes SUD problems when the consent gate is open", () => {
    const out = resolveAutofill(section({ source: "problems_active" }), ctx({ problems }));
    expect(out.lines.map((l) => l.primary)).toContain("Opioid use disorder");
    expect(out.notice).toBeUndefined();
  });

  it("never leaks SUD problems into a masked context", () => {
    const out = resolveAutofill(
      section({ source: "problems_active" }),
      ctx({ problems, sudLocked: true }),
    );
    expect(out.lines.map((l) => l.primary)).toEqual(["Hypertension"]);
    expect(JSON.stringify(out)).not.toContain("Opioid");
    expect(out.notice).toBe(PART2_AUTOFILL_NOTICE);
  });

  it("never summarises a SUD note in a masked context", () => {
    const notes = [
      {
        id: "n1",
        date: NOW.toISOString(),
        category: "sud",
        sessionType: "individual",
        assessment: "Part 2 content",
        status: "signed",
        signedBy: "x",
        signedAt: NOW.toISOString(),
      },
    ] as never[];
    const out = resolveAutofill(
      section({ source: "last_note_summary" }),
      ctx({ notes, sudLocked: true }),
    );
    expect(JSON.stringify(out)).not.toContain("Part 2 content");
    expect(out.notice).toBe("No prior finalized note available.");
  });
});

describe("autofill — mar window and allergies", () => {
  it("only includes administrations inside the trailing window", () => {
    const administrations = [
      { id: "d1", orderId: "o1", scheduledAt: "2026-03-10T08:00:00.000Z", action: "given" },
      { id: "d2", orderId: "o1", scheduledAt: "2026-03-08T08:00:00.000Z", action: "given" },
    ] as never[];
    const out = resolveAutofill(
      section({ source: "mar_last_24h" }),
      ctx({ administrations, orders: [order()], orderName: () => "Sertraline" }),
    );
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]!.primary).toContain("Sertraline");
  });

  it("lists active allergies only", () => {
    const allergies = [
      { id: "a1", substance: "Penicillin", reaction: "hives", severity: "mild", active: true },
      { id: "a2", substance: "Latex", severity: "mild", active: false },
    ] as Allergy[];
    const out = resolveAutofill(section({ source: "allergies" }), ctx({ allergies }));
    expect(out.lines.map((l) => l.primary)).toEqual(["Penicillin"]);
  });
});

describe("quick picks are a starting point, not a bypass", () => {
  it("produces a draft that still fails the order validation gate", () => {
    const draft = draftOrderFromQuickPick({ id: "qp1", drugName: "Ibuprofen" });
    const issues = validateOrder({ ...draft, id: "o9", patientId: "p1", status: "draft" } as MedOrder, {
      needsAttribution: false,
    });
    // No dose, no frequency, no off-catalog justification — all still blocking.
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.map((i) => i.field)).toContain("dose");
  });

  it("carries the note link and the authored clinical flags", () => {
    const draft = draftOrderFromQuickPick(
      {
        id: "qp2",
        drugName: "Buprenorphine/naloxone",
        dose: "8-2 mg",
        frequencyCode: "QAM",
        isControlled: true,
        deaSchedule: "CIII",
        isKop: true,
      },
      { sourceNoteId: "note_1", createdBy: "Nurse A" },
    );
    expect(draft.sourceNoteId).toBe("note_1");
    expect(draft.isControlled).toBe(true);
    expect(draft.deaSchedule).toBe("CIII");
    expect(draft.isKop).toBe(true);
    expect(draft.frequency).toBeTruthy();
  });
});

describe("non-field sections are exempt from note required-field enforcement", () => {
  it("orders and autofill sections never contribute missing fields", () => {
    const schema: TemplateSchema = {
      sections: [
        {
          id: "o",
          title: "Orders",
          type: "orders_section",
          fields: [{ key: "ghost", type: "text", label: "Ghost", required: true }],
        },
        section({ source: "allergies" }),
      ],
    };
    expect(findMissingRequired(schema, {})).toHaveLength(0);
  });
});

describe("signed autofill snapshots are frozen", () => {
  it("discharge sources: booking release info and open referrals", () => {
    const bookings = [
      {
        id: "b1",
        patientId: "p1",
        bookingNumber: "BK-1",
        facilityId: "fac-1",
        facilityName: "Fresno County Jail — Main",
        bookedAt: "2026-02-01T00:00:00.000Z",
        releasedAt: "2026-03-01T00:00:00.000Z",
        bookingReason: "SUD treatment placement",
        createdBy: "x",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ] as never[];
    const housingMoves = [
      { id: "h1", bookingId: "b1", housingUnit: "C-Pod 12", movedAt: "2026-02-10T00:00:00.000Z" },
    ] as never[];
    const open = resolveAutofill(
      section({ source: "booking_release_info" }),
      ctx({ bookings, housingMoves }),
    );
    expect(open.lines[0]!.primary).toContain("Released");
    expect(open.lines[1]!.secondary).toContain("C-Pod 12");
    expect(JSON.stringify(open)).toContain("SUD treatment placement");

    const masked = resolveAutofill(
      section({ source: "booking_release_info" }),
      ctx({ bookings, housingMoves, sudLocked: true }),
    );
    expect(JSON.stringify(masked)).not.toContain("SUD treatment placement");
    expect(masked.notice).toBe(PART2_AUTOFILL_NOTICE);

    const referrals = [
      { id: "r1", category: "housing", provider: "Turning Point", status: "pending" },
      { id: "r2", category: "food", provider: "Done Co", status: "completed" },
      {
        id: "r3",
        category: "benefits",
        provider: "SUD outpatient clinic",
        status: "accepted",
        sudDisclosureConsent: true,
      },
    ] as never[];
    const all = resolveAutofill(section({ source: "referrals_open" }), ctx({ referrals }));
    expect(all.lines).toHaveLength(2);
    expect(JSON.stringify(all)).not.toContain("Done Co");

    const gated = resolveAutofill(
      section({ source: "referrals_open" }),
      ctx({ referrals, sudLocked: true }),
    );
    expect(gated.lines.map((l) => l.primary)).toEqual(["housing — Turning Point"]);
    expect(JSON.stringify(gated)).not.toContain("SUD outpatient clinic");
    expect(gated.notice).toBe(PART2_AUTOFILL_NOTICE);
  });

  it("freezes a discharge referral snapshot at signing", () => {
    const patientId = AdelanteEHR.listPatients()[0]!.id;
    const note = AdelanteEHR.addProgressNote(patientId, {
      clinicianId: "c1",
      date: new Date().toISOString(),
      sessionType: "individual",
      subjective: "s",
      objective: "",
      assessment: "",
      plan: "",
      authorSource: "human",
      status: "draft",
    })!;
    const referrals = [
      { id: "r1", category: "housing", provider: "Turning Point", status: "pending" },
    ] as never[];
    const snapshot = resolveAutofill(section({ source: "referrals_open" }), ctx({ referrals }));
    AdelanteEHR.signProgressNote(patientId, note.id, {
      signedBy: "Dr. Bagga",
      role: "pmhnp",
      attested: true,
      autofillSnapshots: [snapshot],
    });
    const later = resolveAutofill(
      section({ source: "referrals_open" }),
      ctx({
        referrals: [
          ...referrals,
          { id: "r2", category: "legal", provider: "New Co", status: "pending" },
        ] as never[],
      }),
    );
    expect(later.lines).toHaveLength(2);
    const stored = AdelanteEHR.getPatient(patientId)?.progressNotes?.find((n) => n.id === note.id);
    expect(stored?.autofillSnapshots?.[0]?.lines).toHaveLength(1);
  });

  it("does not change when the patient's data changes afterward", () => {
    const patientId = AdelanteEHR.listPatients()[0]!.id;
    const note = AdelanteEHR.addProgressNote(patientId, {
      clinicianId: "c1",
      date: new Date().toISOString(),
      sessionType: "individual",
      subjective: "s",
      objective: "",
      assessment: "",
      plan: "",
      authorSource: "human",
      status: "draft",
    })!;
    const snapshot = resolveAutofill(
      section({ source: "medications_active" }),
      ctx({ orders: [order()] }),
    );
    AdelanteEHR.signProgressNote(patientId, note.id, {
      signedBy: "Dr. Bagga",
      role: "pmhnp",
      attested: true,
      autofillSnapshots: [snapshot],
    });

    // Data changes after signing must not rewrite the attested document.
    const later = resolveAutofill(
      section({ source: "medications_active" }),
      ctx({ orders: [order(), order({ id: "o2", drugName: "New drug" })] }),
    );
    expect(later.lines).toHaveLength(2);

    const stored = AdelanteEHR.getPatient(patientId)?.progressNotes?.find((n) => n.id === note.id);
    expect(stored?.autofillSnapshots?.[0]?.lines.map((l) => l.primary)).toEqual(["Sertraline"]);
  });
});