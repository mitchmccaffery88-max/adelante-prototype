// §Orders — server function wrapper for the DailyMed strength fallback.
// Server-side because DailyMed serves no CORS headers (see dailymed.server.ts).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lookupDailyMedStrength } from "./dailymed.server";

export const getDailyMedStrength = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        rxcui: z.string().optional(),
        name: z.string().optional(),
        expectedIngredients: z.number().int().positive().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => (await lookupDailyMedStrength(data)) ?? null);
