// Draft — pending clinical sign-off. Browser-open approximation, not a scheduler.
import { AdelanteEHR } from './ehr';
import { runActionOrThrow } from './actions/runAction';
import { screenerFollowupActor } from './screenerFollowup';
export function runEngagementRiskSweep(now = new Date()) {
  for (const p of AdelanteEHR.listPatients()) runActionOrThrow('engagement_risk_automation', screenerFollowupActor, p, { args: [p.id, now.toISOString(), screenerFollowupActor], auditReason: 'Engagement check automation' });
}
