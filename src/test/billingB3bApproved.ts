// Mitch delegated approval: only the three billing ingestion declarations.
const substitutions: [string, string][] = [["const appointments = useEhr(() => AdelanteEHR.listAppointments());", "const appointments = useEhr(() => billingAppointments());"], ["const patients = useEhr(() => AdelanteEHR.listPatients());", "const patients = useEhr(() => billingPatients());"], ["const claims = useEhrExt(() => AdelanteEHRExt.listClaims());", "const claims = useEhrExt(() => billingClaims());"],
// Friday cleanup (Mitch, Oct 23) — standalone-claim rows show the stored
// serviceDate, not the first history timestamp. Display/sort only.
["date: c.history[0]?.at ?? c.updatedAt,", "date: c.serviceDate ?? c.history[0]?.at ?? c.updatedAt,"]];
export function withApprovedBillingB3b(path: string, source: string): string {
  if (path !== "src/routes/billing.tsx") return source;
  for (const [from, to] of substitutions) {
    if (source.split(from).length !== 2) throw new Error(`B3b anchor not found exactly once: ${from}`);
    source = source.replace(from, to);
  }
  return source;
}
