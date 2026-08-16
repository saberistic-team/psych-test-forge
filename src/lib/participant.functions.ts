import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { scoreResponses, ResponseError, type ScoreResult } from "./scoring";
import { specSchema } from "./spec";

export const getTestByCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(4).max(12) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test } = await supabaseAdmin
      .from("tests")
      .select("id, title, spec, access_code, published, creator_id")
      .eq("access_code", data.code.trim().toUpperCase())
      .is("deleted_at", null)
      .maybeSingle();
    if (!test || !test.published) return { found: false as const, test: null };
    const parsed = specSchema.safeParse(test.spec);
    if (!parsed.success) return { found: false as const, test: null };
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, org, name")
      .eq("id", test.creator_id)
      .maybeSingle();
    return {
      found: true as const,
      test: {
        id: test.id,
        title: test.title,
        code: test.access_code,
        spec: parsed.data,
        creatorPlan: profile?.plan ?? "free",
        creatorOrg: profile?.org ?? null,
      },
    };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        testId: z.string().uuid(),
        participantId: z.string().min(6).max(64),
        participantName: z.string().max(80).nullish(),
        responses: z.record(z.string(), z.number()),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test } = await supabaseAdmin
      .from("tests")
      .select("id, spec, published, creator_id")
      .eq("id", data.testId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!test || !test.published) return { ok: false as const, issues: {}, message: "This test is not open." , attemptId: null };

    const parsed = specSchema.safeParse(test.spec);
    if (!parsed.success) {
      return { ok: false as const, issues: {}, message: "This test's definition is invalid.", attemptId: null };
    }

    const { checkAndCountAttempt } = await import("./usage.server");
    const gate = await checkAndCountAttempt(test.creator_id);
    if (!gate.allowed) return { ok: false as const, issues: {}, message: gate.reason, attemptId: null };

    let scores;
    try {
      scores = scoreResponses(parsed.data, data.responses);
    } catch (err) {
      if (err instanceof ResponseError) {
        return {
          ok: false as const,
          issues: err.issues,
          message: "Some answers are missing or out of range.",
          attemptId: null,
        };
      }
      throw err;
    }

    const { data: attempt, error } = await supabaseAdmin
      .from("attempts")
      .insert({
        test_id: test.id,
        participant_id: data.participantId,
        participant_name: data.participantName ?? null,
        responses: data.responses,
        scores: JSON.parse(JSON.stringify(scores)),
        validity: JSON.parse(JSON.stringify(scores.validity)),
      })
      .select("id")
      .single();
    if (error || !attempt) throw new Error(error?.message ?? "Could not save the attempt.");
    return { ok: true as const, issues: {}, message: "", attemptId: attempt.id };
  });

export const getAttemptResult = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        participantId: z.string().min(6).max(64),
        environment: z.enum(["sandbox", "live"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attempt } = await supabaseAdmin
      .from("attempts")
      .select("id, test_id, participant_id, participant_name, responses, scores, validity, created_at")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (!attempt || attempt.participant_id !== data.participantId) return { found: false as const, result: null };

    const { data: test } = await supabaseAdmin
      .from("tests")
      .select("id, title, spec, access_code, creator_id")
      .eq("id", attempt.test_id)
      .maybeSingle();
    const parsed = specSchema.safeParse(test?.spec);
    if (!test || !parsed.success) return { found: false as const, result: null };

    const [{ data: report }, { data: cohort }, { data: profile }, { data: sub }] = await Promise.all([
      supabaseAdmin
        .from("premium_reports")
        .select("purchased")
        .eq("participant_id", attempt.participant_id)
        .eq("purchased", true)
        .eq("environment", data.environment)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from("attempts").select("scores").eq("test_id", test.id).limit(1000),
      supabaseAdmin.from("profiles").select("plan, org").eq("id", test.creator_id).maybeSingle(),
      supabaseAdmin
        .from("subscriptions")
        .select("status, plan, current_period_end")
        .eq("participant_id", attempt.participant_id)
        .eq("plan", "results_plus")
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const cohortAverages: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const row of cohort ?? []) {
      const subs = (row.scores as { subscales?: { subscale: string; score: number }[] })?.subscales ?? [];
      for (const s of subs) {
        cohortAverages[s.subscale] = (cohortAverages[s.subscale] ?? 0) + s.score;
        counts[s.subscale] = (counts[s.subscale] ?? 0) + 1;
      }
    }
    for (const key of Object.keys(cohortAverages)) {
      cohortAverages[key] = Number((cohortAverages[key]! / (counts[key] || 1)).toFixed(2));
    }

    const subInPeriod = !sub?.current_period_end || new Date(sub.current_period_end).getTime() > Date.now();
    const resultsPlus = Boolean(sub) && subInPeriod &&
      ["active", "trialing", "past_due", "canceled"].includes(sub!.status);
    return {
      found: true as const,
      result: {
        attemptId: attempt.id,
        participantName: attempt.participant_name,
        createdAt: attempt.created_at,
        testTitle: test.title,
        code: test.access_code,
        spec: parsed.data,
        scores: attempt.scores as unknown as ScoreResult,
        premium: Boolean(report?.purchased) || resultsPlus,
        resultsPlus,
        watermark: (profile?.plan ?? "free") === "free",
        creatorOrg: profile?.org ?? null,
        cohortAverages,
        cohortSize: cohort?.length ?? 0,
      },
    };
  });

export const getMyHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        participantId: z.string().min(6).max(64),
        environment: z.enum(["sandbox", "live"]).default("live"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attempts } = await supabaseAdmin
      .from("attempts")
      .select("id, test_id, scores, created_at")
      .eq("participant_id", data.participantId)
      .order("created_at", { ascending: false })
      .limit(100);
    const testIds = [...new Set((attempts ?? []).map((a) => a.test_id))];
    const { data: tests } = testIds.length
      ? await supabaseAdmin.from("tests").select("id, title").in("id", testIds)
      : { data: [] };
    const titles = new Map((tests ?? []).map((t) => [t.id, t.title]));
    const [{ data: sub }, { data: unlock }] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("participant_id", data.participantId)
        .eq("plan", "results_plus")
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("premium_reports")
        .select("purchased")
        .eq("participant_id", data.participantId)
        .eq("purchased", true)
        .eq("environment", data.environment)
        .limit(1)
        .maybeSingle(),
    ]);
    const inPeriod = !sub?.current_period_end || new Date(sub.current_period_end).getTime() > Date.now();
    return {
      premium: Boolean(unlock?.purchased),
      resultsPlus: Boolean(sub) && inPeriod && ["active", "trialing", "past_due", "canceled"].includes(sub!.status),
      attempts: (attempts ?? []).map((a) => ({
        id: a.id,
        testId: a.test_id,
        title: titles.get(a.test_id) ?? "Test",
        scores: a.scores as unknown as ScoreResult,
        createdAt: a.created_at,
      })),
    };
  });
