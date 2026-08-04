// §Clinical documentation Phase 3b — autofill_section resolver.
//
// Pure functions: the caller supplies the patient's data, this returns the
// rendered content. That keeps the SUD consent gate an explicit input
// (`sudLocked`) rather than something this module decides on its own, and it
// makes the snapshot behaviour directly testable.
//
// STANDING GAP: vitals and labs are NOT autofill sources because they do not
// exist as entities in Adelante at all. They are absent from `AutofillSource`
// rather than stubbed, so nothing can be wired against an empty source.
// Target schema when that gap is closed: `src/lib/labsVitalsScaffold.ts`.

import {
  isProblemClinicallyActive,
  noteStatus,
  type Allergy,
  type Booking,
  type DoseAdministration,
  type HousingMove,
  type MedOrder,
  type ProgressNote,
  type Problem,
  type ResourceReferral,
} from "@/lib/ehr";
import { isOrderActive, isPrnOrder } from "@/lib/orders";
import {
  isFieldsSection,
  sectionTitle,
  type AutofillLine,
  type AutofillSnapshot,
  type TemplateLanguage,
  type TemplateSchema,
  type TemplateSection,
} from "@/lib/templateSchema";

export const PART2_AUTOFILL_NOTICE =
  "Some entries are hidden by the 42 CFR Part 2 consent gate.";

/**
 * §Discharge summary — a resource referral is treated as Part 2 sensitive when
 * it carries the SUD-disclosure consent flag, since that flag is only ever set
 * on referrals whose detail is SUD-identifying. Same discipline as
 * `problems_active`: masked rows are omitted entirely, never counted.
 */
export function isReferralSudSensitive(r: ResourceReferral): boolean {
  return r.sudDisclosureConsent === true;
}

/** Open = anything not yet completed — the same rule the Referrals tab uses. */
export function isReferralOpen(r: ResourceReferral): boolean {
  return r.status !== "completed";
}

export interface AutofillContext {
  now?: Date;
  orders: MedOrder[];
  allergies: Allergy[];
  problems: Problem[];
  administrations: DoseAdministration[];
  notes: ProgressNote[];
  /** Newest booking first (matches `AdelanteEHR.listBookings`). */
  bookings?: Booking[];
  /** Newest move first (matches `AdelanteEHR.listHousingMoves`). */
  housingMoves?: HousingMove[];
  /** Patient-scoped resource referrals. */
  referrals?: ResourceReferral[];
  /**
   * True when the acting context may NOT see SUD-sensitive content. Same gate
   * (`canAccess(role, "screeners_sud", patient)`) the Notes tab and problem
   * list already use — passed in so there is one decision, made once.
   */
  sudLocked: boolean;
  /** The note being authored; never summarised as "the last note". */
  excludeNoteId?: string;
  /** Resolves an order id to a display name for MAR rows. */
  orderName?: (orderId: string) => string;
  language?: TemplateLanguage;
}

function excerpt(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function medLine(o: MedOrder): AutofillLine {
  const bits = [o.dose, o.route, o.frequency ?? o.frequencyCode].filter(Boolean).join(" · ");
  const flags = [
    isPrnOrder(o) ? "PRN" : null,
    o.isKop ? "KOP" : null,
    o.isControlled ? (o.deaSchedule ?? "controlled") : null,
    o.status === "held" ? "held" : null,
  ].filter(Boolean);
  return {
    primary: o.drugName,
    secondary: [bits, flags.join(", ")].filter(Boolean).join(" · ") || undefined,
  };
}

/** Resolve ONE autofill section against the supplied data. */
export function resolveAutofill(
  section: TemplateSection,
  ctx: AutofillContext,
): AutofillSnapshot {
  const now = ctx.now ?? new Date();
  const cfg = section.autofill;
  const lang = ctx.language ?? "en";
  const base: AutofillSnapshot = {
    sectionId: section.id,
    title: sectionTitle(section, lang),
    source: cfg?.source ?? "medications_active",
    resolvedAt: now.toISOString(),
    lines: [],
  };
  if (!cfg) return { ...base, notice: "No autofill source configured." };

  let lines: AutofillLine[] = [];
  let notice: string | undefined;

  switch (cfg.source) {
    case "medications_active": {
      const includePrn = cfg.includePrn !== false;
      lines = ctx.orders
        .filter(isOrderActive)
        .filter((o) => includePrn || !isPrnOrder(o))
        .map(medLine);
      break;
    }
    case "allergies": {
      lines = ctx.allergies
        .filter((a) => a.active)
        .map((a) => ({
          primary: a.substance,
          secondary: [a.reaction, a.severity].filter(Boolean).join(" · ") || undefined,
        }));
      break;
    }
    case "problems_active": {
      const active = ctx.problems.filter(isProblemClinicallyActive);
      const visible = ctx.sudLocked ? active.filter((p) => p.category !== "sud") : active;
      // Masked entries are omitted entirely and only acknowledged generically —
      // a count would itself leak the presence of Part 2 content.
      if (ctx.sudLocked && visible.length !== active.length) notice = PART2_AUTOFILL_NOTICE;
      lines = visible.map((p) => ({
        primary: p.description,
        secondary: [p.icd10Code, p.onsetDate ? `onset ${p.onsetDate}` : null]
          .filter(Boolean)
          .join(" · ") || undefined,
      }));
      break;
    }
    case "mar_last_24h": {
      const hours = cfg.hours && cfg.hours > 0 ? cfg.hours : 24;
      const cutoff = +now - hours * 3_600_000;
      lines = ctx.administrations
        .filter((a) => !a.voided && +new Date(a.scheduledAt) >= cutoff)
        .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
        .map((a) => ({
          primary: `${ctx.orderName?.(a.orderId) ?? a.orderId} — ${a.action}`,
          secondary: [a.scheduledAt, a.reason, a.isPrn ? "PRN" : null]
            .filter(Boolean)
            .join(" · "),
        }));
      break;
    }
    case "last_note_summary": {
      const prior = ctx.notes
        .filter((n) => n.id !== ctx.excludeNoteId)
        .filter((n) => ["signed", "cosigned"].includes(noteStatus(n)))
        .filter((n) => !(ctx.sudLocked && n.category === "sud"))
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
      if (!prior) {
        notice = "No prior finalized note available.";
        break;
      }
      // A reference, not a content dump: title + one short excerpt.
      lines = [
        {
          primary: prior.templateTitle ?? `${prior.sessionType} note`,
          secondary: new Date(prior.date).toISOString(),
        },
        { primary: excerpt(prior.assessment || prior.subjective || "") || "(no narrative)" },
      ];
      break;
    }
  }

  if (cfg.limit && cfg.limit > 0 && lines.length > cfg.limit) {
    lines = lines.slice(0, cfg.limit);
  }
  if (!lines.length && !notice) notice = "Nothing on file.";
  return { ...base, source: cfg.source, lines, notice };
}

/** Resolve every autofill_section in a schema, in document order. */
export function resolveAutofillSections(
  schema: TemplateSchema | undefined,
  ctx: AutofillContext,
): AutofillSnapshot[] {
  return (schema?.sections ?? [])
    .filter((s) => !isFieldsSection(s) && s.type === "autofill_section")
    .map((s) => resolveAutofill(s, ctx));
}