// Minimal funding-only view; never hands clinical appointment fields to Intake.
import { AdelanteEHR } from "./ehr";
import { canIntakeAct, intakeAppointmentDetail, intakeState, referralForIntake, type IntakeActor } from "./intakePhaseA";
import type { AppointmentFundingRecord } from "./fundingSource";

export interface FundingAppointmentView {
  id: string;
  start: string;
  fundingSource?: AppointmentFundingRecord;
}

/** Active referral's own first-visit receipts only; handoff stays read-only. */
export function intakeFundingAppointments(actor: IntakeActor, referralId: string): FundingAppointmentView[] {
  if (!canIntakeAct(actor, "first_visit")) return [];
  try {
    if (intakeState(referralId, actor).completedAt) return [];
    const referral = referralForIntake(referralId);
    if (!referral.enrolledPatientId) return [];
    return AdelanteEHR.appointmentsForPatient(referral.enrolledPatientId).flatMap(a => {
      const receipt = intakeAppointmentDetail(actor, referralId, a.id);
      if (!("id" in receipt) || !receipt.id || !receipt.start) return [];
      return [{ id: receipt.id, start: receipt.start, fundingSource: a.fundingSource ? { ...a.fundingSource, flags: [...a.fundingSource.flags] } : undefined }];
    });
  } catch {
    return [];
  }
}