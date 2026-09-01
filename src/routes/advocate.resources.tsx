// §Advocate Access Redesign Phase 3 — Universal Resource Directory.
//
// The community directory is universal, ungated content, not patient data, so
// an advocate browses EXACTLY what a patient browses: same store, same search,
// same categories, same detail view. This file is now only a layout so the
// detail view can live inside the advocate shell.
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/advocate/resources")({
  component: () => <Outlet />,
});
