// §5d-4 — the ONE patient-facing list of needs and what happened with each.
//
// Renders `patientNeedThread.ts` output. Every sentence comes from the i18n
// dictionary (English/Spanish); nothing is composed in English here beyond
// joining a translated fragment to an organisation name.
//
// Staff material — the 5d-3 activity log, barriers, contact attempts, staff
// notes — is not reachable from this component: the selector never returns it.
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { SDOH_SOURCE_LABEL, type SdohPlanItem } from "@/lib/ehr";
import {
  patientNeedThreads,
  recentlyResolvedNeeds,
  unlinkedPatientReferrals,
  type NeedReferralLine,
} from "@/lib/patientNeedThread";

type NeedThreadItem = SdohPlanItem;

function ReferralLine({ line }: { line: NeedReferralLine }) {
  const { t } = useI18n();
  const org = line.orgName ?? t("needRefOrgWithheld");
  return (
    <li className="rounded-md border bg-card/60 p-2.5 text-sm">
      <span className="text-navy">
        {t(line.statusKey as never)} {org}.
      </span>
      {line.orgWithheld && (
        <span className="mt-1 block text-xs text-muted-foreground">
          {t("needRefOrgWithheldNote")}
        </span>
      )}
    </li>
  );
}

export function NeedThreadList({
  patientId,
  renderMatch,
}: {
  patientId: string;
  /**
   * The directory suggestion for this need, rendered INSIDE its card. Passing
   * it in keeps a single list: the page no longer repeats the same needs in a
   * second block underneath.
   */
  renderMatch?: (need: NeedThreadItem) => React.ReactNode;
}) {
  const { t } = useI18n();
  const threads = patientNeedThreads(patientId);
  const other = unlinkedPatientReferrals(patientId);
  const resolved = recentlyResolvedNeeds(patientId);


  return (
    <div className="space-y-4">
      {resolved.length > 0 && (
        <Card className="p-5" data-testid="need-thread-resolved">
          <div className="text-xs font-medium uppercase tracking-wider text-teal">
            {t("needThreadResolvedHeading")}
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {resolved.map((r) => (
              <li key={r.needId} className="text-navy">
                {t("needClosureResolved")} {r.need}.{" "}
                <span className="text-muted-foreground">{t("needClosureTail")}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {threads.map((thread) => (
        <Card key={thread.need.id} className="p-5" data-testid={`need-block-${thread.need.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-navy">{thread.need.need}</div>
            <Badge variant="outline" className="text-[10px]">
              {SDOH_SOURCE_LABEL[thread.need.source]}
            </Badge>
          </div>
          {thread.referrals.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="need-no-referral">
              {t(thread.noReferralKey as never)}
            </p>
          ) : (
            <ul className="mt-3 space-y-2" data-testid="need-referrals">
              {thread.referrals.map((line) => (
                <ReferralLine key={line.referralId} line={line} />
              ))}
            </ul>
          )}
          {renderMatch?.(thread.need)}
        </Card>
      ))}

      {other.length > 0 && (
        <Card className="p-5" data-testid="need-thread-other">
          <div className="text-xs font-medium uppercase tracking-wider text-teal">
            {t("needThreadOtherHeading")}
          </div>
          <ul className="mt-2 space-y-2">
            {other.map((line) => (
              <ReferralLine key={line.referralId} line={line} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/**
 * The home-screen entry point. Deliberately a COUNT plus a link, never a
 * second list — two lists of the same needs would drift and disagree.
 */
export function NeedThreadSummaryCard({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const count = patientNeedThreads(patientId).length;
  return (
    <Card className="p-5" data-testid="need-thread-summary">
      <div className="text-xs font-medium uppercase tracking-wider text-teal">
        {t("needThreadSummaryTitle")}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {count === 0
          ? t("needThreadSummaryNone")
          : count === 1
            ? t("needThreadSummaryOne")
            : `${count} ${t("needThreadSummaryMany")}`}
      </p>
      <Button asChild size="sm" variant="outline" className="mt-3">
        <Link to="/next-steps">{t("needThreadSummaryOpen")}</Link>
      </Button>
    </Card>
  );
}
