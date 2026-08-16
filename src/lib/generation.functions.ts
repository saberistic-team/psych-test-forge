import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        request: z.string().min(8),
        pathHint: z.enum(["auto", "established", "novel"]).default("auto"),
        model: z.string().min(3),
        temperature: z.number().min(0).max(2).default(0.7),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { checkAndCountGeneration } = await import("./usage.server");
    const gate = await checkAndCountGeneration(userId);
    if (!gate.allowed) {
      return { blocked: true as const, reason: gate.reason, plan: gate.plan, jobId: null };
    }

    const { data: job, error: jobError } = await supabase
      .from("generation_jobs")
      .insert({
        creator_id: userId,
        request: data.request,
        path_hint: data.pathHint,
        model: data.model,
        temperature: data.temperature,
        status: "running",
      })
      .select("id")
      .single();
    if (jobError || !job) throw new Error(jobError?.message ?? "Could not start the generation job.");

    const { generateSpec } = await import("./llm.server");
    try {
      const { spec } = await generateSpec({
        request: data.request,
        pathHint: data.pathHint,
        model: data.model,
        temperature: data.temperature,
      });
      const { data: test, error: testError } = await supabase
        .from("tests")
        .insert({
          creator_id: userId,
          title: spec.instructions.title,
          slug: spec.instructions.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60),
          spec: JSON.parse(JSON.stringify(spec)),
          published: false,
        })
        .select("id")
        .single();
      if (testError || !test) throw new Error(testError?.message ?? "Could not save the generated test.");

      await supabase
        .from("generation_jobs")
        .update({ status: "done", test_id: test.id, errors: null })
        .eq("id", job.id);
      return { blocked: false as const, jobId: job.id, testId: test.id, errors: [] as string[] };
    } catch (err) {
      const message = (err as Error).message;
      const details = (err as Error & { details?: string[] }).details ?? [];
      await supabase
        .from("generation_jobs")
        .update({ status: "error", errors: { message, details } })
        .eq("id", job.id);
      return { blocked: false as const, jobId: job.id, testId: null, errors: [message, ...details] };
    }
  });

export const getGenerationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("generation_jobs")
      .select("id, status, errors, test_id, model, temperature, request, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return job;
  });

export const listGenerationJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("generation_jobs")
      .select("id, status, request, model, test_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
