import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { specSchema } from "./spec";

/**
 * Public config for the embeddable widget. Attribution can only be hidden while the
 * author is on a paid plan — the flag is stored per test but the plan is checked here,
 * so a downgrade brings the "Powered by Psych Lab" link back automatically.
 */
export const getEmbedConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ code: z.string().min(4).max(12) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test } = await supabaseAdmin
      .from("tests")
      .select("id, title, tagline, spec, access_code, published, creator_id, price_cents, sale_mode, hide_attribution")
      .eq("access_code", data.code.trim().toUpperCase())
      .is("deleted_at", null)
      .maybeSingle();
    if (!test || !test.published) return { found: false as const, embed: null };
    const parsed = specSchema.safeParse(test.spec);
    if (!parsed.success) return { found: false as const, embed: null };

    const { planForUser } = await import("./usage.server");
    const plan = await planForUser(test.creator_id);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("org, name")
      .eq("id", test.creator_id)
      .maybeSingle();

    const itemCount = parsed.data.items.length;
    return {
      found: true as const,
      embed: {
        code: test.access_code as string,
        title: test.title as string,
        tagline: (test.tagline as string | null) ?? parsed.data.meta.construct,
        construct: parsed.data.meta.construct,
        itemCount,
        minutes: Math.max(1, Math.round(itemCount / 6)),
        author: (profile?.org || profile?.name || null) as string | null,
        priceCents: test.price_cents ?? 0,
        saleMode: (test.sale_mode ?? "free") as "free" | "take" | "results",
        showAttribution: !(test.hide_attribution && plan.id !== "free"),
      },
    };
  });

export const setHideAttribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), hide: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { planForUser } = await import("./usage.server");
    const plan = await planForUser(context.userId);
    if (data.hide && plan.id === "free") {
      return {
        ok: false as const,
        hide: false,
        reason: "Removing the Psych Lab link is available on paid plans.",
      };
    }
    const { error } = await context.supabase
      .from("tests")
      .update({ hide_attribution: data.hide })
      .eq("id", data.id)
      .eq("creator_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, hide: data.hide };
  });
