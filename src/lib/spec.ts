import { z } from "zod";

/** Test spec contract shared by the generator, the database and the scoring engine. */

const bandSchema = z.object({ min: z.number(), max: z.number() });
const rangesSchema = z.record(z.string(), bandSchema);

export const RESULTS_STYLES = ["radar", "gauges", "bars", "rings", "terrain", "constellation"] as const;
export const BANNER_PATTERNS = ["waves", "dots", "grid", "mountains", "stars", "none"] as const;
export type ResultsStyle = (typeof RESULTS_STYLES)[number];
export type BannerPattern = (typeof BANNER_PATTERNS)[number];

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color like #1B2A4A");

export const visualsSchema = z.object({
  icon: z.object({
    type: z.enum(["emoji", "svg"]),
    value: z.string().min(1),
    style: z.string().default(""),
  }),
  banner: z.object({
    gradient: z.array(hexColor).min(2).max(3),
    pattern: z.enum(BANNER_PATTERNS).default("none"),
    accent: hexColor,
    caption: z.string().default(""),
  }),
  results: z.object({
    style: z.enum(RESULTS_STYLES),
    theme: z.string().default(""),
    description: z.string().default(""),
  }),
});

export type TestVisuals = z.infer<typeof visualsSchema>;

export const specSchema = z.object({

  meta: z.object({
    schema_version: z.string().default("1.0"),
    path: z.enum(["established", "novel"]),
    decision_path: z.string().min(3),
    construct: z.string().min(2),
    construct_rationale: z.string().nullish(),
    established_test_name: z.string().nullish(),
    fidelity: z.enum(["exact", "reconstructed"]).nullish(),
    fidelity_note: z.string().nullish(),
    theory_framework: z.string().min(2),
    subscales: z.array(z.string().min(1)).min(1),
    references: z.array(z.string()).default([]),
    target_population: z.string().default("Adults"),
    time_to_complete_minutes: z.number().positive().default(6),
    licensing_caution: z.string().nullish(),
  }),
  instructions: z.object({
    title: z.string().min(2),
    prompt_text: z.string().min(5),
    response_scale: z.object({
      type: z.string().default("likert"),
      min: z.number().int(),
      max: z.number().int(),
      labels: z.record(z.string(), z.string()),
    }),
  }),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(3),
        subscale: z.string().min(1),
        reverse_scored: z.boolean().default(false),
        is_attention_check: z.boolean().default(false),
        expected_answer: z.number().nullish(),
      }),
    )
    .min(10),
  scoring: z.object({
    method: z.enum(["sum", "mean"]),
    reverse_logic: z.string().default("new = (max + min) - raw"),
    subscale_scores: z.object({
      calc: z.string().default("mean of subscale item scores"),
      ranges: rangesSchema,
    }),
    overall_score: z.object({
      enabled: z.boolean(),
      calc: z.string().default("mean of all non-attention items"),
      ranges: rangesSchema,
    }),
    validity_check: z.object({
      enabled: z.boolean(),
      rule: z.string().default("attention item answered as expected"),
      action: z.enum(["warn", "invalidate"]),
    }),
  }),
  interpretation: z.object({
    per_subscale: z.record(z.string(), z.record(z.string(), z.string())),
    overall: z.record(z.string(), z.string()),
    disclaimer: z.string().min(10),
  }),
  administration: z.object({
    instructions_for_admin: z.string().default(""),
    scoring_instructions: z.string().default(""),
    report_template: z.string().default(""),
  }),
  // Optional in the schema so specs created before visuals shipped still parse;
  // generation and publishing require it (see validateSpec / requireVisuals).
  visuals: visualsSchema.optional(),
});

export type TestSpec = z.infer<typeof specSchema>;
export type SpecItem = TestSpec["items"][number];

const CLINICAL_WORDS = ["diagnose", "diagnoses", "diagnosis", "treats", "cures", "confirms"];

/** Validates a spec and returns human-readable error strings for the self-repair loop. */
export function validateSpec(
  input: unknown,
  opts: { requireVisuals?: boolean } = {},
): { spec?: TestSpec; errors: string[] } {
  const parsed = specSchema.safeParse(input);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
    };
  }
  const spec = parsed.data;
  const errors: string[] = [];
  if (opts.requireVisuals && !spec.visuals) {
    errors.push(
      `visuals: a complete visuals block is required — { icon: {type,value,style}, banner: {gradient:[hex,hex],pattern,accent,caption}, results: {style one of ${RESULTS_STYLES.join("|")}, theme, description} }`,
    );
  }
  const subscales = new Set(spec.meta.subscales);


  for (const item of spec.items) {
    if (!subscales.has(item.subscale)) {
      errors.push(`items.${item.id}.subscale "${item.subscale}" is not listed in meta.subscales`);
    }
    if (item.is_attention_check && (item.expected_answer === null || item.expected_answer === undefined)) {
      errors.push(`items.${item.id} is an attention check but has no expected_answer`);
    }
  }
  const ids = spec.items.map((i) => i.id);
  if (new Set(ids).size !== ids.length) errors.push("items: item ids must be unique");

  const { min, max } = spec.instructions.response_scale;
  if (max <= min) errors.push("instructions.response_scale.max must be greater than min");
  for (let v = min; v <= max; v++) {
    if (!spec.instructions.response_scale.labels[String(v)]) {
      errors.push(`instructions.response_scale.labels is missing a label for ${v}`);
    }
  }

  if (Object.keys(spec.scoring.subscale_scores.ranges).length < 2) {
    errors.push("scoring.subscale_scores.ranges must define at least two bands");
  }
  for (const sub of spec.meta.subscales) {
    if (!spec.interpretation.per_subscale[sub]) {
      errors.push(`interpretation.per_subscale is missing an entry for "${sub}"`);
    }
  }
  if (spec.scoring.validity_check.enabled && !spec.items.some((i) => i.is_attention_check)) {
    errors.push("scoring.validity_check is enabled but no item has is_attention_check = true");
  }
  const disc = spec.interpretation.disclaimer.toLowerCase();
  for (const word of CLINICAL_WORDS) {
    if (disc.includes(word)) {
      errors.push(
        `interpretation.disclaimer must be non-clinical — remove the word "${word}" and use wording like "indicates a tendency / invites reflection"`,
      );
      break;
    }
  }
  return errors.length ? { errors } : { spec, errors: [] };
}

export function itemCount(spec: TestSpec): number {
  return spec.items.length;
}
