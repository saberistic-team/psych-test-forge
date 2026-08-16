import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Regenerates icon + banner + results style for one of the caller's tests. */
export const regenerateVisuals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ testId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { specSchema } = await import("./spec");
    const { buildVisuals } = await import("./visuals.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("tests")
      .select("id, spec")
      .eq("id", data.testId)
      .eq("creator_id", context.userId)
      .maybeSingle();
    if (!row) return { ok: false as const, visuals: null, generated: false, errors: ["Test not found."] };
    const parsed = specSchema.safeParse(row.spec);
    if (!parsed.success) return { ok: false as const, visuals: null, generated: false, errors: ["The stored spec is invalid."] };
    const { visuals, generated } = await buildVisuals(parsed.data);
    const next = { ...parsed.data, visuals };
    const { error } = await supabaseAdmin
      .from("tests")
      .update({ spec: JSON.parse(JSON.stringify(next)) })
      .eq("id", data.testId)
      .eq("creator_id", context.userId);
    if (error) return { ok: false as const, visuals: null, generated: false, errors: [error.message] };
    return { ok: true as const, visuals, generated, errors: [] as string[] };
  });

/** Fills in visuals only if the spec has none (used after importing legacy JSON). */
export const ensureVisuals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ testId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { ensureTestVisuals } = await import("./visuals.server");
    return ensureTestVisuals(data.testId, context.userId);
  });

/** Saves creator edits to the visuals block. */
export const saveVisuals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ testId: z.string().uuid(), visuals: z.unknown() }).parse(input))
  .handler(async ({ data, context }) => {
    const { writeTestVisuals } = await import("./visuals.server");
    return writeTestVisuals(data.testId, context.userId, data.visuals);
  });
