import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { supabase } from "./integrations/supabase/client";

// Phase 1 authenticated foundation calls attach the session bearer; server
// middleware verifies it. Disabled memory/default flows do not invoke these.
const foundationAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [foundationAuth],
}));
