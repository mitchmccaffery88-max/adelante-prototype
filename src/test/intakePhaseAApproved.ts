// 26 Oct Phase A (Mitch): exact-once booking/group additions only.
// Consent, conflict, location, non-Intake booking, reschedule and clinical
// selector bodies remain pinned to the immutable historical baseline.
const DELTAS: [string, string][] = [
  [
    "import { bookingRightFor, canScheduleRole, checkBookingRights, isPrescriberServiceType } from \"./bookingRights\";",
    "import { bookingRightFor, canScheduleRole, checkBookingRights, isPrescriberServiceType } from \"./bookingRights\";\nimport { assertIntakeBookingBoundary, assertIntakeGroupBoundary, type IntakeBookingProof } from \"./intakeBookingBoundary\";"
  ],
  [
    "    bookedBy?: { id: string; role: string };\n    /** Staff member who renders a contact visit",
    "    bookedBy?: { id: string; role: string };\n    /** 26 Oct Phase A: dedicated referral proof, never a generic scheduling grant. */\n    intakeBooking?: IntakeBookingProof;\n    /** Staff member who renders a contact visit"
  ],
  [
    "      const chk = checkBookingRights({\n        role: bookRole!,\n        op: \"book\",\n        inCaseload: _inStaffCaseload(input.bookedBy!, input.patientId),\n        serviceType: input.serviceType,\n        asam: !!input.asamTaskId,\n      });\n      if (!chk.ok) throw new Error(`${chk.reason} ${chk.next}`);",
    "      // 26 Oct Phase A: Intake has no generic booking right. The registered\n      // boundary checks actor/referral/indication/first-kind/calendar before\n      // the unchanged fit, consent, location and conflict checks below.\n      if (bookRole === \"intake_coordinator\") assertIntakeBookingBoundary(input);\n      else {\n        const chk = checkBookingRights({\n          role: bookRole, op: \"book\",\n          inCaseload: input.bookedBy ? _inStaffCaseload(input.bookedBy, input.patientId) : false,\n          serviceType: input.serviceType, asam: !!input.asamTaskId,\n        });\n        if (!chk.ok) throw new Error(`${chk.reason} ${chk.next}`);\n      }"
  ],
  [
    "    const { allowPatientOverlap: _ignored, requestId, bookedBy, ...fields } = input;",
    "    const { allowPatientOverlap: _ignored, requestId, bookedBy, intakeBooking, ...fields } = input;"
  ],
  [
    "      status: \"scheduled\",\n      ...(bookedBy?.id && !fields.assignedStaffId",
    "      status: \"scheduled\",\n      ...(intakeBooking ? { intakeFirstVisit: { referralId: intakeBooking.referralId, kind: intakeBooking.kind as import(\"./intakePhaseA\").FirstVisitKind }, bookedBy } : {}),\n      ...(bookedBy?.id && !fields.assignedStaffId"
  ],
  [
    "  requestJoinGroup(input: { sessionId: string; patientId: string; note?: string; now?: string }): GroupJoinRequest {",
    "  requestJoinGroup(input: { sessionId: string; patientId: string; note?: string; now?: string; onBehalf?: { referralId: string; staffId: string; role: StaffRole } }): GroupJoinRequest {\n    // 26 Oct Phase A: same pending/clinical approval path, real staff attribution.\n    if (input.onBehalf) assertIntakeGroupBoundary(input);"
  ],
  [
    "      status: \"pending\",\n      protected: isProtected,\n    };\n    groupJoinRequests.push(row);",
    "      status: \"pending\",\n      protected: isProtected,\n      ...(input.onBehalf ? { requestedBy: { ...input.onBehalf }, onBehalfOfPatient: true } : {}),\n    };\n    groupJoinRequests.push(row);"
  ],
  [
    "      actorRole: \"patient\",\n      actorId: `patient:${input.patientId}`,\n      detail: {\n        groupSessionId: g.id,",
    "      actorRole: input.onBehalf?.role ?? \"patient\",\n      actorId: input.onBehalf?.staffId ?? `patient:${input.patientId}`,\n      detail: {\n        ...(input.onBehalf ? { referralId: input.onBehalf.referralId, onBehalfOfPatient: true } : {}),\n        groupSessionId: g.id,"
  ],
  [
    "  if (!actor?.name?.trim()) throw new Error(\"Sign in as a staff member first.\");\n  if (!(GROUP_ELIGIBILITY_ROLES as readonly string[]).includes(actor.role))",
    "  if (!actor?.name?.trim()) throw new Error(\"Sign in as a staff member first.\");\n  // 26 Oct Phase A: on-behalf Intake placement always requires clinical approval.\n  if (r.onBehalfOfPatient && !SUD_GROUP_APPROVER_ROLES.includes(actor.role)) throw new Error(\"Clinical approval required for Intake group requests.\");\n  if (!(GROUP_ELIGIBILITY_ROLES as readonly string[]).includes(actor.role))"
  ]
];
export function withIntakePhaseA(path: string, source: string): string {
  if (path !== "src/lib/ehr.ts") return source;
  for (const [from, to] of DELTAS) {
    if (source.split(from).length !== 2) throw new Error(`Phase A anchor not found exactly once in ${path}`);
    source = source.replace(from, to);
  }
  return source;
}
