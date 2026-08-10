import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/start")({
  component: StartLayout,
});

function StartLayout() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Outlet />
    </div>
  );
}
