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
    const { checkAndCountGeneration, releaseGeneration } = await import("./usage.server");
    const gate = await checkAndCountGeneration(userId);
    if (!gate.allowed) {
      return { blocked: true as const, reason: gate.reason, plan: gate.plan, jobId: null, testId: null, errors: [] as string[], counted: false };
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
    if (jobError || !job) {
      await releaseGeneration(userId);
      throw new Error(jobError?.message ?? "Could not start the generation job.");
    }

    const { runGenerationJob } = await import("./generation.server");
    const result = await runGenerationJob({
      jobId: job.id,
      userId,
      request: data.request,
      pathHint: data.pathHint,
      model: data.model,
      temperature: data.temperature,
      counted: true,
    });

    if (!result.ok) {
      // Failed runs are never charged against the plan.
      await releaseGeneration(userId);
      return { blocked: false as const, jobId: job.id, testId: null, errors: result.errors, counted: false };
    }
    return { blocked: false as const, jobId: job.id, testId: result.testId, errors: [] as string[], counted: true };
  });

/** Re-runs a failed job from its stored request. Retries are not charged another credit. */
export const retryGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase
      .from("generation_jobs")
      .select("id, request, path_hint, model, temperature, status, creator_id")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job || job.creator_id !== userId) {
      return { ok: false as const, jobId: null, testId: null, errors: ["That generation run could not be found."] };
    }
    if (job.status === "running") {
      return { ok: false as const, jobId: job.id, testId: null, errors: ["That run is still in progress."] };
    }

    const { runGenerationJob } = await import("./generation.server");
    const result = await runGenerationJob({
      jobId: job.id,
      userId,
      request: job.request,
      pathHint: job.path_hint,
      model: job.model,
      temperature: Number(job.temperature),
      counted: false,
    });
    return result.ok
      ? { ok: true as const, jobId: job.id, testId: result.testId, errors: [] as string[] }
      : { ok: false as const, jobId: job.id, testId: null, errors: result.errors };
  });

export const getGenerationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("generation_jobs")
      .select("id, status, errors, test_id, model, temperature, request, path_hint, created_at, updated_at")
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
      .select("id, status, request, model, temperature, path_hint, test_id, errors, created_at, updated_at")
      .eq("creator_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
