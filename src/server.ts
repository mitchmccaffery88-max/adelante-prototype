import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Structured production error log: one JSON line per failure so the live
// worker logs show WHAT broke, WHERE (request) and WHY (stack), whether the
// throw reached our catch or h3 swallowed it into a generic 500 first.
function logProductionError(
  source: "thrown" | "h3-swallowed" | "module-load",
  error: unknown,
  request?: Request,
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  let url: string | undefined;
  let method: string | undefined;
  try {
    if (request) {
      url = request.url;
      method = request.method;
    }
  } catch {
    // Request fields must never break logging.
  }
  console.error(
    JSON.stringify({
      tag: "production-error",
      source,
      method,
      url,
      name: err.name,
      message: err.message,
      stack: err.stack,
      at: new Date().toISOString(),
    }),
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  request: Request,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const captured = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  logProductionError("h3-swallowed", captured, request);
  return new Response(renderErrorPage(captured), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, request);
    } catch (error) {
      logProductionError(serverEntryPromise ? "thrown" : "module-load", error, request);
      return new Response(renderErrorPage(error), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
