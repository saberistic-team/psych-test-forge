import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateSpec } from "./spec";

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, name, org, plan, billing_cycle_start").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const { readUsage, planForUser } = await import("./usage.server");
    const [usage, plan] = await Promise.all([readUsage(userId), planForUser(userId)]);
    return {
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      usage,
      plan,
    };
  });

export const listMyTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tests")
      .select(
        "id, title, spec, access_code, published, listed, featured, verified, tagline, listing_description, created_at, updated_at",
      )
      .eq("creator_id", context.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: attempts } = await context.supabase.from("attempts").select("test_id");
    const counts = new Map<string, number>();
    for (const a of attempts ?? []) counts.set(a.test_id, (counts.get(a.test_id) ?? 0) + 1);
    return (data ?? []).map((t) => ({ ...t, attempt_count: counts.get(t.id) ?? 0 }));
  });

export const getMyTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: test, error } = await context.supabase
      .from("tests")
      .select(
        "id, title, spec, access_code, published, listed, featured, verified, tagline, listing_description, created_at, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return test;
  });

export const saveTestSpec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), spec: z.unknown() }).parse(input))
  .handler(async ({ data, context }) => {
    const { spec, errors } = validateSpec(data.spec);
    if (!spec) return { ok: false as const, errors };
    const { error } = await context.supabase
      .from("tests")
      .update({ spec: JSON.parse(JSON.stringify(spec)), title: spec.instructions.title })
      .eq("id", data.id)
      .eq("creator_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, errors: [] as string[] };
  });

export const importTestSpec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ raw: z.string().min(20) }).parse(input))
  .handler(async ({ data, context }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.raw);
    } catch {
      return { ok: false as const, errors: ["The pasted text is not valid JSON."], testId: null };
    }
    const { spec, errors } = validateSpec(parsed);
    if (!spec) return { ok: false as const, errors, testId: null };
    const { data: test, error } = await context.supabase
      .from("tests")
      .insert({
        creator_id: context.userId,
        title: spec.instructions.title,
        spec: JSON.parse(JSON.stringify(spec)),
        published: false,
      })
      .select("id")
      .single();
    if (error || !test) throw new Error(error?.message ?? "Could not import the spec.");
    return { ok: true as const, errors: [] as string[], testId: test.id };
  });

export const setPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), published: z.boolean(), regenerateCode: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.published) {
      const { error } = await supabase
        .from("tests")
        .update({ published: false, listed: false, featured: false })
        .eq("id", data.id)
        .eq("creator_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true as const, blocked: false as const, code: null };
    }

    const { planForUser } = await import("./usage.server");
    const plan = await planForUser(userId);
    if (!plan.canPublish) {
      return {
        ok: false as const,
        blocked: true as const,
        code: null,
        reason: `Publishing is a paid feature. The ${plan.name} plan keeps tests as private drafts.`,
      };
    }

    const { data: existing } = await supabase
      .from("tests")
      .select("access_code")
      .eq("id", data.id)
      .eq("creator_id", userId)
      .maybeSingle();

    let code = existing?.access_code ?? null;
    if (!code || data.regenerateCode) {
      const { makeAccessCode } = await import("./llm.server");
      for (let i = 0; i < 12; i++) {
        const candidate = makeAccessCode();
        const { data: clash } = await supabase.from("tests").select("id").eq("access_code", candidate).maybeSingle();
        if (!clash) {
          code = candidate;
          break;
        }
      }
    }
    const { error } = await supabase
      .from("tests")
      .update({ published: true, access_code: code })
      .eq("id", data.id)
      .eq("creator_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, blocked: false as const, code };
  });

export const deleteTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tests")
      .update({ deleted_at: new Date().toISOString(), published: false })
      .eq("id", data.id)
      .eq("creator_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTestAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ testId: z.string().uuid().nullish() }).parse(input))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("attempts")
      .select("id, test_id, participant_name, responses, scores, validity, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.testId) query = query.eq("test_id", data.testId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Paid plans are granted by the payments webhook only; this endpoint can
  // downgrade to Free (paid cancellation happens in the billing portal).
  .inputValidator((input: unknown) => z.object({ plan: z.literal("free") }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ plan: data.plan })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, plan: data.plan };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().max(120).nullish(), org: z.string().max(160).nullish() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ name: data.name ?? null, org: data.org ?? null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Role check runs as the caller under RLS: they can only read their own role rows.
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: tests }, { data: attempts }, { data: reports }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, name, org, plan, created_at").order("created_at"),
      supabaseAdmin.from("tests").select("id, creator_id, published"),
      supabaseAdmin.from("attempts").select("id, test_id, created_at"),
      supabaseAdmin.from("premium_reports").select("id, amount, purchased"),
    ]);
    const testsByCreator = new Map<string, { total: number; live: number }>();
    for (const t of tests ?? []) {
      const cur = testsByCreator.get(t.creator_id) ?? { total: 0, live: 0 };
      cur.total++;
      if (t.published) cur.live++;
      testsByCreator.set(t.creator_id, cur);
    }
    const { CREATOR_PLANS } = await import("./plans");
    const mrrCents = (profiles ?? []).reduce(
      (sum, p) => sum + (CREATOR_PLANS.find((c) => c.id === p.plan)?.priceCents ?? 0),
      0,
    );
    const reportRevenue = (reports ?? [])
      .filter((r) => r.purchased)
      .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
    return {
      creators: (profiles ?? []).map((p) => ({
        ...p,
        tests: testsByCreator.get(p.id)?.total ?? 0,
        live: testsByCreator.get(p.id)?.live ?? 0,
      })),
      totals: {
        creators: profiles?.length ?? 0,
        tests: tests?.length ?? 0,
        attempts: attempts?.length ?? 0,
        mrrCents,
        reportRevenue,
      },
    };
  });
