import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/start")({
  component: StartLayout,
});

function StartLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/start/signup") return <Outlet />;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Outlet />
    </div>
  );
}
