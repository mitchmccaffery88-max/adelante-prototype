// ═══════════════════════════════════════════════════════════════════════
// NOT IMPLEMENTED — schema scaffold only.
// No UI reads this. No data ever populates it. No runtime code imports it.
// See ClickUp: Labs & Vitals infrastructure.
//
// This file is the documented target shape for the dev team picking up the
// labs/vitals gap that currently blocks: note autofill sources, Population
// Health metrics, and the Inbox "Results" tab (deliberately omitted rather
// than shipped as a permanently-empty tab).
//
// Provenance:
//  - LabResultRecord mirrors the reference `lab_results` columns 1:1.
//  - VitalsReading is INFERRED (no reference table was read for it); treat
//    its fields as a proposal, not a contract.
// ═══════════════════════════════════════════════════════════════════════

/** Mirrors reference `lab_results`. Field names camelCased; column name in comment. */
export interface LabResultRecord {
  id: string;
  patientId: string;
  testCode?: string;           // test_code
  testName: string;            // test_name
  category?: string;           // category
  valueNumeric?: number;       // value_numeric
  valueText?: string;          // value_text
  units?: string;              // units
  referenceLow?: number;       // reference_low
  referenceHigh?: number;      // reference_high
  abnormalFlag?: string;       // abnormal_flag (e.g. "H" | "L" | "A")
  collectedAt?: string;        // collected_at (ISO)
  resultedAt?: string;         // resulted_at (ISO)
  reviewStatus: "unreviewed" | "acknowledged"; // review_status
}

/** INFERRED shape — not read from a reference table. */
export interface VitalsReading {
  id: string;
  patientId: string;
  vitalType: string;   // e.g. "bp_systolic" | "hr" | "temp_c" | "spo2" | "weight_kg"
  value: number;
  unit: string;        // e.g. "mmHg" | "bpm" | "C" | "%" | "kg"
  recordedAt: string;  // ISO
  recordedBy?: string;
}
