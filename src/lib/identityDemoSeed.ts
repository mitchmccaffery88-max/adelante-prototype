// §Batch E — identity demo data, all through normal store functions:
//  1. staff-created "Luis Camacho", DOB one day off → Probable, in the queue
//  2. patient self sign-up exactly matching Rosa → neutral message + staff review
//  3. a pair decided "Not the same person"
//  4. a completed merge with a consent needing review and a duplicate claim
import { AdelanteEHR } from "./ehr";
import { AdelanteEHRExt } from "./ehr-ext";
import { SignupNeedsVerificationError } from "./patientMatching";
import { runAction } from "./actions/runAction";
import { listMatchReviews } from "./patientMatching";

const PRIYA = { staffId: "s-cc1", name: "Priya Raman", role: "clinical_coordinator" as const };
let done = false;

function plusDay(dob: string, n = 1): string {
  const d = new Date(`${dob}T12:00:00Z`);
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
}
type CreateIn = Parameters<typeof AdelanteEHR.createPatient>[0];
const create = (i: Record<string, unknown>) => AdelanteEHR.createPatient(i as CreateIn);

export function seedIdentityDemo() {
  if (done) return;
  done = true;
  const all = AdelanteEHR.listPatients();
  const luis = all.find((p) => p.firstName === "Luis" && p.lastName === "Camacho");
  if (luis) create({ firstName: "Luis", lastName: "Camacho", dob: plusDay(luis.dob), phone: "+15595550188", preferredLanguage: "es", matchSource: "staff_create" });

  const rosa = all.find((p) => p.firstName === "Rosa");
  if (rosa)
    try {
      create({ firstName: rosa.firstName, lastName: rosa.lastName, dob: rosa.dob, cin: rosa.cin, phone: "+15595550999", matchSource: "self_signup" });
    } catch (e) {
      if (!(e instanceof SignupNeedsVerificationError)) throw e;
    }

  // Not the same person: two Daniela Ortiz records a day apart.
  create({ firstName: "Daniela", lastName: "Ortiz", dob: "1991-03-04", phone: "+15595550141", matchSource: "seed" });
  const d2 = create({ firstName: "Daniela", lastName: "Ortiz", dob: "1991-03-05", phone: "+15595550142", matchSource: "staff_create" });
  const rev = listMatchReviews().find((r) => r.newPatientId === d2.id);
  if (rev)
    runAction("patient_match_decide", PRIYA, d2, {
      via: "markNotSamePerson",
      args: [rev.id, "Different mothers' names and addresses — twins' cousins, confirmed by phone.", PRIYA],
    });

  // Completed merge: Tomás Reyes created twice (DOB digits transposed).
  const t1 = create({ firstName: "Tomás", lastName: "Reyes", dob: "1987-06-12", phone: "+15595550160", matchSource: "seed" });
  const t2 = create({ firstName: "Tomas", lastName: "Reyes", dob: "1987-06-21", phone: "+15595550160", matchSource: "staff_create" });
  const today = new Date().toISOString().slice(0, 10);
  AdelanteEHR.createConsentRecord({
    patientId: t2.id,
    formType: "AB133",
    source: "Front desk (demo)",
    signedByName: "Tomas Reyes",
    attested: true,
    effectiveDate: today,
    sections: [{ category: "mental_health", authorized: true }],
    capturedBy: { staffId: PRIYA.staffId, staffName: PRIYA.name, role: PRIYA.role },
  });
  // A Part 2 instrument on the merged-away record — stays held until consent is re-confirmed.
  AdelanteEHR.recordScreener(t2.id, { key: "audit", score: 9, severity: "moderate", completedAt: new Date().toISOString(), timepoint: "intake" });
  const clin = AdelanteEHR.listClinicians()[0]?.id ?? "c1";
  AdelanteEHRExt.createAsamClaim({ asamId: "demo-merge-a", patientId: t1.id, clinicianId: clin, serviceDate: today });
  AdelanteEHRExt.createAsamClaim({ asamId: "demo-merge-b", patientId: t2.id, clinicianId: clin, serviceDate: today });
  runAction("patient_merge", PRIYA, t1, {
    via: "mergePatients",
    args: [{ survivorId: t1.id, otherId: t2.id, reason: "Same person — phone and address match; DOB typed with digits swapped." }, PRIYA],
  });
}

export function _resetIdentityDemoForTests() {
  done = false;
}
