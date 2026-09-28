// Lets the header, Brief cards and Adel Brief open a "+ New" drawer by action
// id. The launcher still decides whether the action is allowed (registry).
export const CHART_ACTION_EVENT = "adelante:chart-action";
export function openChartAction(actionId: string): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHART_ACTION_EVENT, { detail: actionId }));
}
