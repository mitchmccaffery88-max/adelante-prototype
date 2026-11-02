// R57 Draft — pending clinical sign-off. Immediate per-member engagement
// re-check after a successful staff write (outreach attempt, missed visit,
// late cancel, phone/address change). Cycle-free: it only listens to the
// existing store change notification and compares record metadata; the
// contact store and ehr.ts import nothing from here. Writes run through the
// existing system-only `engagement_risk_automation` registry entry, the same
// per-member step as the app-open sweep (which stays as the backstop).
import { AdelanteEHR, type Patient } from './ehr';
import { listContacts } from './caseloadReview';
import { runAction } from './actions/runAction';
import { screenerFollowupActor } from './screenerFollowup';

/** Metadata only: ids of attempts, missed/late-cancelled visits and phone/address revisions. Never content. */
export function engagementTriggerSignature(p: Patient): string {
  const attempts = listContacts(p.id).filter(c => c.type === 'attempt').map(c => c.id).sort();
  const missed = AdelanteEHR.listAppointments().filter(a => a.patientId === p.id && ['no_show', 'late_cancel'].includes(a.status)).map(a => `${a.id}:${a.status}`).sort();
  const contact = (p.demographicsHistory ?? []).filter(h => h.changes.some(c => ['phone', 'address'].includes(c.field) && c.before !== c.after)).map(h => h.id).sort();
  return JSON.stringify([attempts, missed, contact]);
}

let uninstall: (() => void) | undefined;

/** Idempotent. Returns an uninstall function. */
export function installEngagementRecheck(): () => void {
  if (uninstall) return uninstall;
  const seen = new Map<string, string>();
  for (const p of AdelanteEHR.listPatients()) seen.set(p.id, engagementTriggerSignature(p));
  let running = false;
  const listener = () => {
    if (running) return;
    running = true;
    try {
      for (const p of AdelanteEHR.listPatients()) {
        const sig = engagementTriggerSignature(p);
        const before = seen.get(p.id);
        seen.set(p.id, sig);
        if (before === undefined || before === sig) continue;
        runAction('engagement_risk_automation', screenerFollowupActor, p, { args: [p.id, new Date().toISOString(), screenerFollowupActor], auditReason: 'Engagement check automation' });
        seen.set(p.id, engagementTriggerSignature(p));
      }
    } catch {
      // A re-check must never break the staff write that triggered it.
    } finally {
      running = false;
    }
  };
  const off = AdelanteEHR.subscribe(listener);
  uninstall = () => { off(); uninstall = undefined; };
  return uninstall;
}
