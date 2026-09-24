// §Referrals Rework Phase 4a — shared rendering for referral state.
//
// Three surfaces used to index the referral status into a three-item order
// array to draw a progress bar. A `declined` referral has no index in that
// array, so it would have rendered as an empty, "nothing has happened yet"
// strip — the opposite of the truth. These two small pieces keep all three
// surfaces honest without merging the cards themselves (that is Phase 4b).
import {
  REFERRAL_PROGRESS_STAGES,
  type Referral,
  type ReferralStatus,
} from "@/lib/ehr";
import { latestOutreachAttempt, outreachAttemptSummary } from "@/lib/referralOutreach";
import { ClientDate } from "@/components/ClientDate";

export const REFERRAL_STATUS_STYLES: Record<ReferralStatus, string> = {
  submitted: "bg-gold/30 text-navy",
  contacted: "bg-teal/20 text-teal",
  enrolled: "bg-success/20 text-success",
  declined: "bg-muted text-muted-foreground",
};

/**
 * Progress across the three real stages. A declined referral stops at the
 * stage it actually reached and is drawn as an ended state, never as blank.
 */
export function ReferralProgressStrip({ status }: { status: ReferralStatus }) {
  const declined = status === "declined";
  const reachedIdx = declined
    ? 0
    : REFERRAL_PROGRESS_STAGES.indexOf(status as (typeof REFERRAL_PROGRESS_STAGES)[number]);
  return (
    <div className="mt-2 flex gap-1" aria-label={declined ? "Referral closed" : "Referral progress"}>
      {REFERRAL_PROGRESS_STAGES.map((s, i) => {
        const reached = i <= reachedIdx;
        const tone = declined
          ? reached
            ? "bg-muted-foreground/50"
            : "bg-border"
          : reached
            ? "bg-teal"
            : "bg-border";
        return <div key={s} className={`h-1 flex-1 rounded-full ${tone}`} />;
      })}
    </div>
  );
}

/**
 * Truthful welcome-text status. Nothing here claims a send unless one
 * genuinely happened — the pre-Phase-4a green tick was stamped at submission
 * with no message ever attempted.
 */
export function ReferralOutreachStatus({ referral }: { referral: Referral }) {
  // B4 — a logged manual attempt is the most recent real outreach fact.
  const last = latestOutreachAttempt(referral);
  if (last) {
    return (
      <div
        className={`mt-1.5 text-[10px] ${last.outcome === "reached" ? "text-success" : "text-gold-foreground"}`}
        data-testid="queue-last-attempt"
      >
        {last.outcome === "reached" ? "✓ " : "⚑ "}Last outreach: {outreachAttemptSummary(last)} ·{" "}
        <ClientDate value={last.at} />
      </div>
    );
  }
  const sms = referral.welcomeSms;
  if (sms?.status === "sent") {
    return <div className="mt-1.5 text-[10px] text-success">✓ Welcome text sent</div>;
  }
  if (sms?.status === "not_configured") {
    return (
      <div className="mt-1.5 text-[10px] text-gold-foreground">
        ⚑ Welcome text not sent — text messaging isn't connected yet
      </div>
    );
  }
  if (sms?.status === "failed") {
    return <div className="mt-1.5 text-[10px] text-destructive">⚑ Welcome text failed to send</div>;
  }
  if (referral.outreachTask === "manual_call") {
    return (
      <div className="mt-1.5 text-[10px] text-gold-foreground">
        ⚑ No welcome text — this referral needs a phone call
      </div>
    );
  }
  return <div className="mt-1.5 text-[10px] text-muted-foreground">Welcome text not attempted</div>;
}
