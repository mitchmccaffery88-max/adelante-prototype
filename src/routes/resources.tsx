import { createFileRoute, Outlet } from "@tanstack/react-router";

// §Tier 1 Build B — /resources became a layout so `/resources/saved` can live
// beside the directory itself. The directory moved to resources.index.tsx.
export const Route = createFileRoute("/resources")({
  component: () => <Outlet />,
});
