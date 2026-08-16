import { specSchema, visualsSchema, type TestSpec, type TestVisuals } from "./spec";
import { fallbackVisuals } from "./visuals";

const VISUALS_MODEL = "google/gemini-3.5-flash";

/**
 * Returns a visuals block for a spec, generating one with the art-director model
 * when the spec has none. Falls back to a deterministic palette if the model fails,
 * so importing a legacy spec can never dead-end.
 */
export async function buildVisuals(spec: TestSpec): Promise<{ visuals: TestVisuals; generated: boolean }> {
  const { generateVisualsBlock, summariseSpecForVisuals } = await import("./llm.server");
  try {
    const visuals = await generateVisualsBlock({
      summary: summariseSpecForVisuals(spec),
      model: VISUALS_MODEL,
      temperature: 0.8,
    });
    return { visuals, generated: true };
  } catch {
    return { visuals: fallbackVisuals(spec), generated: false };
  }
}

/** Reads a creator's test, ensures spec.visuals exists, persists it if it was missing. */
export async function ensureTestVisuals(testId: string, creatorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("tests")
    .select("id, spec")
    .eq("id", testId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (!row) return { ok: false as const, visuals: null };
  const parsed = specSchema.safeParse(row.spec);
  if (!parsed.success) return { ok: false as const, visuals: null };
  if (parsed.data.visuals) return { ok: true as const, visuals: parsed.data.visuals };
  const { visuals } = await buildVisuals(parsed.data);
  const next = { ...parsed.data, visuals };
  await supabaseAdmin
    .from("tests")
    .update({ spec: JSON.parse(JSON.stringify(next)) })
    .eq("id", testId)
    .eq("creator_id", creatorId);
  return { ok: true as const, visuals };
}

/** Writes an explicit visuals block (creator edits from the editor panel). */
export async function writeTestVisuals(testId: string, creatorId: string, input: unknown) {
  const parsedVisuals = visualsSchema.safeParse(input);
  if (!parsedVisuals.success) {
    return {
      ok: false as const,
      errors: parsedVisuals.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
      visuals: null,
    };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("tests")
    .select("id, spec")
    .eq("id", testId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (!row) return { ok: false as const, errors: ["Test not found."], visuals: null };
  const parsed = specSchema.safeParse(row.spec);
  if (!parsed.success) return { ok: false as const, errors: ["The stored spec is invalid."], visuals: null };
  const next = { ...parsed.data, visuals: parsedVisuals.data };
  const { error } = await supabaseAdmin
    .from("tests")
    .update({ spec: JSON.parse(JSON.stringify(next)) })
    .eq("id", testId)
    .eq("creator_id", creatorId);
  if (error) return { ok: false as const, errors: [error.message], visuals: null };
  return { ok: true as const, errors: [] as string[], visuals: parsedVisuals.data };
}
