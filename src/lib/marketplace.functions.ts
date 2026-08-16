import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TestVisuals } from "./spec";

export type MarketplaceListing = {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  accessCode: string | null;
  construct: string;
  framework: string;
  subscales: string[];
  items: number;
  minutes: number;
  targetPopulation: string;
  featured: boolean;
  verified: boolean;
  listedAt: string | null;
  creatorOrg: string | null;
  attempts: number;
  visuals: TestVisuals;
};

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Public marketplace feed — only published + listed tests, never drafts. */
export const browseMarketplace = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().max(120).default(""),
        construct: z.string().max(160).default("all"),
        sort: z.enum(["featured", "newest", "popular", "shortest"]).default("featured"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { specSchema } = await import("./spec");
    const { visualsOf } = await import("./visuals");
    const { data: rows } = await db
      .from("tests")
      .select("id, title, tagline, listing_description, access_code, spec, featured, verified, listed_at, creator_id")
      .eq("published", true)
      .eq("listed", true)
      .is("deleted_at", null)
      .order("listed_at", { ascending: false })
      .limit(200);

    const creatorIds = [...new Set((rows ?? []).map((r) => r.creator_id))];
    const [{ data: profiles }, { data: attempts }] = await Promise.all([
      creatorIds.length
        ? db.from("profiles").select("id, org, plan").in("id", creatorIds)
        : Promise.resolve({ data: [] as { id: string; org: string | null; plan: string }[] }),
      db.from("attempts").select("test_id"),
    ]);
    const orgs = new Map((profiles ?? []).map((p) => [p.id, p]));
    const attemptCounts = new Map<string, number>();
    for (const a of attempts ?? []) attemptCounts.set(a.test_id, (attemptCounts.get(a.test_id) ?? 0) + 1);

    const listings: MarketplaceListing[] = [];
    for (const row of rows ?? []) {
      const parsed = specSchema.safeParse(row.spec);
      if (!parsed.success) continue;
      const spec = parsed.data;
      const profile = orgs.get(row.creator_id);
      listings.push({
        id: row.id,
        title: row.title,
        tagline: row.tagline,
        description: row.listing_description,
        accessCode: row.access_code,
        construct: spec.meta.construct,
        framework: spec.meta.theory_framework,
        subscales: spec.meta.subscales,
        items: spec.items.length,
        minutes: spec.meta.time_to_complete_minutes,
        targetPopulation: spec.meta.target_population,
        featured: row.featured,
        verified: row.verified,
        listedAt: row.listed_at,
        // White-label plans hide the "administered by" attribution.
        creatorOrg: profile?.plan === "business" ? null : (profile?.org ?? null),
        attempts: attemptCounts.get(row.id) ?? 0,
        visuals: visualsOf(spec),
      });
    }

    const term = data.search.trim().toLowerCase();
    let filtered = listings.filter((l) => {
      const matchesConstruct = data.construct === "all" || l.construct === data.construct;
      const matchesTerm =
        !term ||
        [l.title, l.tagline ?? "", l.description ?? "", l.construct, l.framework, ...l.subscales]
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesConstruct && matchesTerm;
    });

    filtered = filtered.sort((a, b) => {
      if (data.sort === "newest") return (b.listedAt ?? "").localeCompare(a.listedAt ?? "");
      if (data.sort === "popular") return b.attempts - a.attempts;
      if (data.sort === "shortest") return a.minutes - b.minutes || a.items - b.items;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return (b.listedAt ?? "").localeCompare(a.listedAt ?? "");
    });

    return {
      listings: filtered,
      constructs: [...new Set(listings.map((l) => l.construct))].sort(),
      hero: filtered.find((l) => l.featured) ?? filtered[0] ?? null,
      total: listings.length,
    };
  });

/** Anonymous engagement counter for listing analytics (impressions / join clicks). */
export const recordListingEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ testId: z.string().uuid(), kind: z.enum(["impression", "join"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = await adminDb();
    const { data: test } = await db
      .from("tests")
      .select("id")
      .eq("id", data.testId)
      .eq("published", true)
      .eq("listed", true)
      .maybeSingle();
    if (!test) return { ok: false as const };
    await db.from("listing_events").insert({ test_id: data.testId, kind: data.kind });
    return { ok: true as const };
  });

/** Remaining listing slots for the signed-in creator. */
export const getListingSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listingUsage } = await import("./usage.server");
    const usage = await listingUsage(context.userId);
    return {
      plan: usage.plan.id,
      planName: usage.plan.name,
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
      canRequestFeatured: usage.canRequestFeatured,
    };
  });

export const listOnMarketplace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        testId: z.string().uuid(),
        tagline: z.string().trim().min(8).max(90),
        description: z.string().trim().min(30).max(600),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { data: test } = await db
      .from("tests")
      .select("id, published, listed")
      .eq("id", data.testId)
      .eq("creator_id", context.userId)
      .maybeSingle();
    if (!test) return { ok: false as const, reason: "Test not found." };
    if (!test.published)
      return { ok: false as const, reason: "Publish the test and share its join code before listing it publicly." };

    if (!test.listed) {
      const { checkAndCountListing } = await import("./usage.server");
      const gate = await checkAndCountListing(context.userId);
      if (!gate.allowed) return { ok: false as const, reason: gate.reason };
    }

    const { ensureTestVisuals } = await import("./visuals.server");
    await ensureTestVisuals(data.testId, context.userId);

    const { error } = await db
      .from("tests")
      .update({
        listed: true,
        tagline: data.tagline,
        listing_description: data.description,
        listed_at: new Date().toISOString(),
      })
      .eq("id", data.testId)
      .eq("creator_id", context.userId);
    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const, reason: "" };
  });

export const unlistFromMarketplace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ testId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { error } = await db
      .from("tests")
      .update({ listed: false, featured: false })
      .eq("id", data.testId)
      .eq("creator_id", context.userId);
    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const, reason: "" };
  });

/** Per-listing funnel for the signed-in creator: views → joins → completions → unlocks. */
export const getMyListingAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const { data: tests } = await db
      .from("tests")
      .select("id, title, listed, featured, verified, tagline, listed_at")
      .eq("creator_id", context.userId)
      .eq("listed", true)
      .is("deleted_at", null);
    const ids = (tests ?? []).map((t) => t.id);
    if (!ids.length) return { rows: [] as const };
    const [{ data: events }, { data: attempts }] = await Promise.all([
      db.from("listing_events").select("test_id, kind").in("test_id", ids),
      db.from("attempts").select("id, test_id").in("test_id", ids),
    ]);
    const attemptIds = (attempts ?? []).map((a) => a.id);
    const { data: reports } = attemptIds.length
      ? await db.from("premium_reports").select("attempt_id, purchased, amount").in("attempt_id", attemptIds)
      : { data: [] as { attempt_id: string; purchased: boolean; amount: number | null }[] };
    const purchasedAttempts = new Set((reports ?? []).filter((r) => r.purchased).map((r) => r.attempt_id));
    const revenue = (reports ?? [])
      .filter((r) => r.purchased)
      .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

    return {
      rows: (tests ?? []).map((t) => {
        const impressions = (events ?? []).filter((e) => e.test_id === t.id && e.kind === "impression").length;
        const joins = (events ?? []).filter((e) => e.test_id === t.id && e.kind === "join").length;
        const mine = (attempts ?? []).filter((a) => a.test_id === t.id);
        const unlocks = mine.filter((a) => purchasedAttempts.has(a.id)).length;
        return {
          id: t.id,
          title: t.title,
          tagline: t.tagline,
          featured: t.featured,
          verified: t.verified,
          listedAt: t.listed_at,
          impressions,
          joins,
          completions: mine.length,
          unlocks,
          joinRate: impressions ? Math.round((joins / impressions) * 100) : 0,
          completionRate: joins ? Math.round((mine.length / joins) * 100) : 0,
          unlockRate: mine.length ? Math.round((unlocks / mine.length) * 100) : 0,
        };
      }),
      revenue,
    };
  });

async function assertAdmin(supabase: { from: (t: string) => any }, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/** Admin marketplace console: every listing with its funnel + moderation flags. */
export const getAdminMarketplace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await adminDb();
    const [{ data: tests }, { data: events }, { data: attempts }, { data: profiles }] = await Promise.all([
      db
        .from("tests")
        .select("id, title, tagline, listed, featured, verified, listed_at, creator_id, published")
        .eq("listed", true)
        .is("deleted_at", null)
        .order("listed_at", { ascending: false }),
      db.from("listing_events").select("test_id, kind"),
      db.from("attempts").select("id, test_id"),
      db.from("profiles").select("id, name, org, plan"),
    ]);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      listings: (tests ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        tagline: t.tagline,
        featured: t.featured,
        verified: t.verified,
        published: t.published,
        listedAt: t.listed_at,
        creator: byId.get(t.creator_id)?.name ?? byId.get(t.creator_id)?.org ?? "—",
        creatorPlan: byId.get(t.creator_id)?.plan ?? "free",
        impressions: (events ?? []).filter((e) => e.test_id === t.id && e.kind === "impression").length,
        joins: (events ?? []).filter((e) => e.test_id === t.id && e.kind === "join").length,
        completions: (attempts ?? []).filter((a) => a.test_id === t.id).length,
      })),
    };
  });

export const setListingFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        testId: z.string().uuid(),
        featured: z.boolean().optional(),
        verified: z.boolean().optional(),
        listed: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await adminDb();
    const patch: { featured?: boolean; verified?: boolean; listed?: boolean } = {};
    if (data.featured !== undefined) patch.featured = data.featured;
    if (data.verified !== undefined) patch.verified = data.verified;
    if (data.listed !== undefined) patch.listed = data.listed;
    const { error } = await db.from("tests").update(patch).eq("id", data.testId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
