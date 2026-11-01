import { useEhr } from '@/lib/ehr';
import { engagementFlagFor } from '@/lib/engagementRiskAutomation';
import type { EngagementActor } from '@/lib/engagementRiskBoundary';
import { StatusChip } from '@/components/ui/status-chip';

/** Display only: part 1 owns evaluation, caller/chart gates and neutral reasons. */
export function EngagementFlag({ actor, patientId }: { actor: EngagementActor; patientId: string }) {
  const serialized = useEhr(() => JSON.stringify(engagementFlagFor(actor, patientId) ?? null));
  const flag: ReturnType<typeof engagementFlagFor> = JSON.parse(serialized) ?? undefined;
  if (!flag) return null;
  return <div className="min-w-0 space-y-1" data-testid={`engagement-flag-${patientId}`}>
    <StatusChip lang="en" state={flag.level === 'Elevated' ? 'yourturn' : 'upnext'} label={`Engagement · ${flag.level}`} />
    <p className="text-sm text-ink-muted break-words">{flag.signals.map(signal => signal.reason).join(' · ')}</p>
    <p className="text-sm text-ink-muted">{flag.label}</p>
  </div>;
}