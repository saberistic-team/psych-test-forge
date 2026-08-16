import type { TestSpec } from "./spec";

export type Responses = Record<string, number>;

export type SubscaleScore = { subscale: string; score: number; band: string; items: number };

export type ScoreResult = {
  subscales: SubscaleScore[];
  overall: { enabled: boolean; score: number | null; band: string | null };
  validity: {
    enabled: boolean;
    passed: boolean;
    action: "warn" | "invalidate";
    failedItems: string[];
    message: string;
  };
};

export class ResponseError extends Error {
  issues: Record<string, string>;
  constructor(issues: Record<string, string>) {
    super("Invalid responses");
    this.issues = issues;
  }
}

function bandFor(score: number, ranges: Record<string, { min: number; max: number }>): string {
  const entries = Object.entries(ranges);
  for (const [name, r] of entries) {
    if (score >= r.min && score <= r.max) return name;
  }
  // gap: clamp to the nearest band
  let best = entries[0]?.[0] ?? "unknown";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [name, r] of entries) {
    const dist = score < r.min ? r.min - score : score - r.max;
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

/** Validates responses against the spec, then scores them per §4 rules. */
export function scoreResponses(spec: TestSpec, responses: Responses): ScoreResult {
  const { min, max } = spec.instructions.response_scale;
  const issues: Record<string, string> = {};

  for (const item of spec.items) {
    const raw = responses[item.id];
    if (raw === undefined || raw === null || Number.isNaN(Number(raw))) {
      issues[item.id] = "This question has not been answered.";
      continue;
    }
    const n = Number(raw);
    if (n < min || n > max) {
      issues[item.id] = `Answer must be between ${min} and ${max}.`;
    }
  }
  if (Object.keys(issues).length) throw new ResponseError(issues);

  const scoreOf = (id: string, reverse: boolean) => {
    const raw = Number(responses[id]);
    return reverse ? max + min - raw : raw;
  };

  const aggregate = (values: number[]) =>
    spec.scoring.method === "sum"
      ? values.reduce((a, b) => a + b, 0)
      : values.reduce((a, b) => a + b, 0) / (values.length || 1);

  const subscales: SubscaleScore[] = spec.meta.subscales.map((sub) => {
    const items = spec.items.filter((i) => i.subscale === sub && !i.is_attention_check);
    const values = items.map((i) => scoreOf(i.id, i.reverse_scored));
    const score = Number(aggregate(values).toFixed(2));
    return { subscale: sub, score, band: bandFor(score, spec.scoring.subscale_scores.ranges), items: items.length };
  });

  const attention = spec.items.filter((i) => i.is_attention_check);
  const failedItems = attention
    .filter((i) => i.expected_answer != null && Number(responses[i.id]) !== Number(i.expected_answer))
    .map((i) => i.id);
  const validityEnabled = spec.scoring.validity_check.enabled && attention.length > 0;
  const passed = !validityEnabled || failedItems.length === 0;
  const action = spec.scoring.validity_check.action;

  const nonAttention = spec.items.filter((i) => !i.is_attention_check);
  const overallEnabled = spec.scoring.overall_score.enabled;
  const suppress = overallEnabled && !passed && action === "invalidate";
  const overallScore = overallEnabled
    ? Number(aggregate(nonAttention.map((i) => scoreOf(i.id, i.reverse_scored))).toFixed(2))
    : null;

  return {
    subscales,
    overall: {
      enabled: overallEnabled,
      score: suppress ? null : overallScore,
      band: suppress || overallScore === null ? null : bandFor(overallScore, spec.scoring.overall_score.ranges),
    },
    validity: {
      enabled: validityEnabled,
      passed,
      action,
      failedItems,
      message: passed
        ? "Attention checks passed."
        : action === "invalidate"
          ? "This response did not pass the attention checks, so the overall score has been withheld."
          : "One or more attention checks were missed — interpret these results with care.",
    },
  };
}
