// Approved B3b defaulted coverage input; every other source byte stays pinned.
export function withApprovedBillingWorkspaceB3b(path: string, source: string): string {
  if (path !== "src/lib/billingWorkspace.ts") return source;
  const substitutions = [
    ["export function billingWorkspace(role: StaffRole, claims: Claim[] = AdelanteEHRExt.listClaims()): BillingWorkspace {", "export function billingWorkspace(role: StaffRole, claims: Claim[] = AdelanteEHRExt.listClaims(), coverageRows: CoverageWorklistRow[] = coverageWorklistRows()): BillingWorkspace {"],
    ["eligibilityDue: coverageWorklistRows().filter((r) => ELIGIBILITY_DUE.includes(r.state)),", "eligibilityDue: coverageRows.filter((r) => ELIGIBILITY_DUE.includes(r.state)),"],
  ];
  for (const [from, to] of substitutions) {
    if (source.split(from).length !== 2) throw new Error(`B3b workspace anchor not found exactly once: ${from}`);
    source = source.replace(from, to);
  }
  return source;
}