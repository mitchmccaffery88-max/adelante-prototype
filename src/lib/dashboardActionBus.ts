export const DASHBOARD_ACTION_EVENT = "adelante:dashboard-action";
export interface DashboardActionDetail { actionId: string; patientId?: string }
export function openDashboardAction(actionId: string, patientId?: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<DashboardActionDetail>(DASHBOARD_ACTION_EVENT, { detail: { actionId, patientId } }));
}
