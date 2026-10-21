// Approved B3b OpsWorkspace ingestion only; no other inventory binding changes.
export function withApprovedOpsWorkspaceB3b(path: string, source: string): string {
  if (path !== "src/components/ops/OpsWorkspace.tsx") return source;
  const substitutions = [
    ["const claims = useEhrExt(() => AdelanteEHRExt.listClaims());", "const claims = useEhrExt(() => billingClaims());"],
    ["const patients = useEhr(() => AdelanteEHR.listPatients());", "const patients = useEhr(() => billingPatients());"],
    ["const ws = billingWorkspace(role, claims);", "const ws = billingOpsWorkspace(role, claims);"],
  ];
  for (const [from, to] of substitutions) {
    if (source.split(from).length !== 2) throw new Error(`B3b OpsWorkspace anchor not found exactly once: ${from}`);
    source = source.replace(from, to);
  }
  return source;
}