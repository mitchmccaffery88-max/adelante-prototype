import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "../components/AppShell";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-5xl font-semibold text-foreground">404</h1>
        <h2 className="mt-4 text-lg font-medium">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That screen isn't part of the wireframe.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-md bg-teal px-4 py-2 text-sm font-medium text-teal-foreground hover:opacity-90"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const msg = String((error as { message?: string })?.message ?? "");
  const isChunkError =
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading (chunk|CSS chunk) [\w-]+ failed/i.test(msg);

  const RELOAD_KEY = "__adelante_chunk_reload_at";
  const recentlyReloaded =
    typeof window !== "undefined" &&
    Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) < 10_000;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isChunkError || recentlyReloaded) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }, [isChunkError, recentlyReloaded]);

  const hardReload = () => {
    if (typeof window === "undefined") return;
    try { sessionStorage.removeItem(RELOAD_KEY); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.toString());
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-foreground">
          {isChunkError ? "A newer wireframe build is ready" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isChunkError
            ? "The prototype was updated while you were using it. Reload for the latest build."
            : "Something went wrong. Try again or reload."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-teal-foreground hover:opacity-90"
          >
            Try again
          </button>
          <button
            onClick={hardReload}
            className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Reload app
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0B5563" },
      { name: "robots", content: "noindex" },
      { title: "Adelante EMR — Prototype wireframe" },
      { name: "description", content: "Adelante behavioral-health EMR prototype for scope definition. Synthetic data only." },
      { property: "og:title", content: "Adelante EMR — Prototype wireframe" },
      { property: "og:description", content: "Role-based EMR wireframe. Prototype only — not for clinical use." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
