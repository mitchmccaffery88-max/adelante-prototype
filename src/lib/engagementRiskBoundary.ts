// Registry/store boundary; no clinical data or role grants live here.
import type { StaffRole } from './roles';
export interface EngagementActor { role: StaffRole; staffId?: string }
let closeGate: (actor: EngagementActor, taskId: string) => boolean = () => false;
export function registerEngagementCloseGate(gate: typeof closeGate) { closeGate = gate; }
export function assertEngagementCloseGate(actor: EngagementActor, taskId: string) {
  if (!closeGate(actor, taskId)) throw new Error('This engagement task is not available for this staff member.');
}
