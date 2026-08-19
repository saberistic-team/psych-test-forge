import { RESULTS_STYLES, validateSpec, visualsSchema, type TestSpec, type TestVisuals } from "./spec";

const MASTER_PROMPT = `You are an expert psychometrician and AI prompt engineer. Produce ONE valid,
self-contained JSON psychological test spec. Output ONLY the JSON — no prose, no fences.

FIRST decide which path, then record it in meta.decision_path:
PATH A (established): named instrument requested → reproduce faithfully; set
meta.path="established", meta.fidelity="exact"|"reconstructed", meta.fidelity_note,
meta.established_test_name, and cite originators/year. Preserve original scale and bands.
Add a licensing caution when commercial use is plausible.
PATH B (novel): no named instrument → decide the construct yourself from the given angle;
state why in meta.construct_rationale; anchor in a recognized theory; design 3-6 distinct
subscales; 18-40 items (min 10); 1-5 Likert unless the construct needs otherwise; reverse-score
at least half of subscales; include at least one attention/validity check item with expected_answer.

HARD RULES:
- Output is ONLY the JSON matching the schema (meta, instructions, items, scoring,
  interpretation, administration, visuals). Every item.subscale must be in meta.subscales.
- visuals is MANDATORY. YOU choose the art direction, and it must be visually coherent with the
  construct (a "digital serenity" test -> calm icon, cool gradient, rings; a drive/ambition test ->
  bold icon, warm gradient, gauges). visuals.results.style MUST be exactly one of
  radar | gauges | bars | rings | terrain | constellation. Use radar only with 3+ subscales.
  Colors must be 6-digit hex. icon.type is "emoji" (a single expressive emoji) or "svg"
  (a self-contained inline <svg> string using currentColor).
- Ranges must be consistent with the response scale and scoring.method (mean→1-5 style bounds;
  sum→raw sums).
- interpretation.disclaimer MUST be non-clinical: never "diagnoses/confirms/treats".
  Use "indicates a tendency / invites reflection".
- The JSON must parse.

SCHEMA (keys and shapes are mandatory):
{
  "meta": {"schema_version":"1.0","path":"established|novel","decision_path":"string","construct":"string","construct_rationale":"string|null","established_test_name":"string|null","fidelity":"exact|reconstructed|null","fidelity_note":"string","theory_framework":"string","subscales":["string"],"references":["string"],"target_population":"string","time_to_complete_minutes":0,"licensing_caution":"string|null"},
  "instructions": {"title":"string","prompt_text":"string","response_scale":{"type":"likert","min":1,"max":5,"labels":{"1":"...","2":"...","3":"...","4":"...","5":"..."}}},
  "items": [{"id":"q01","text":"string","subscale":"must be in meta.subscales","reverse_scored":false,"is_attention_check":false,"expected_answer":null}],
  "scoring": {"method":"sum|mean","reverse_logic":"new = (max + min) - raw","subscale_scores":{"calc":"string","ranges":{"low":{"min":1.0,"max":2.4},"moderate":{"min":2.5,"max":3.4},"high":{"min":3.5,"max":5.0}}},"overall_score":{"enabled":true,"calc":"string","ranges":{"low":{"min":1.0,"max":2.4},"moderate":{"min":2.5,"max":3.4},"high":{"min":3.5,"max":5.0}}},"validity_check":{"enabled":true,"rule":"string","action":"warn|invalidate"}},
  "interpretation": {"per_subscale":{"SUBSCALE":{"low":"string","moderate":"string","high":"string"}},"overall":{"low":"string","moderate":"string","high":"string"},"disclaimer":"string"},
  "administration": {"instructions_for_admin":"string","scoring_instructions":"string","report_template":"string"},
  "visuals": {"icon":{"type":"emoji|svg","value":"single emoji or inline <svg>...</svg>","style":"short design description"},"banner":{"gradient":["#112233","#445566"],"pattern":"waves|dots|grid|mountains|stars|none","accent":"#77AABB","caption":"one-line concept for the banner art"},"results":{"style":"radar|gauges|bars|rings|terrain|constellation","theme":"visual metaphor tying the chart to the construct","description":"how subscale + overall scores map onto the visual and how low/moderate/high bands are distinguished"}}
}
Band names used in interpretation.per_subscale and interpretation.overall MUST match the band names in scoring ranges.

User request: `;

function pathDirective(pathHint: string): string {
  if (pathHint === "established")
    return "\n\nThe creator explicitly requires PATH A (an established, named instrument).";
  if (pathHint === "novel")
    return "\n\nThe creator explicitly requires PATH B (a novel test whose construct you decide).";
  return "";
}

/** Strips fences and balances braces to recover JSON from a model response. */
export function extractJson(text: string): unknown {
  let raw = text.trim();
  raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("The model response contained no JSON object.");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(raw.slice(start, i + 1));
    }
  }
  throw new Error("The model response contained unbalanced JSON.");
}

/** Gateway failure with an explicit retryability flag (see gateway error semantics). */
export class GatewayError extends Error {
  status: number;
  retryable: boolean;
  retryAfterSeconds: number | null;
  constructor(message: string, status: number, retryable: boolean, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callModelOnce(
  messages: { role: string; content: string }[],
  model: string,
  temperature: number,
): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new GatewayError("The AI gateway is not configured for this project.", 401, false);
  const body: Record<string, unknown> = { model, messages, stream: false };
  if (!model.startsWith("openai/gpt-5")) body["temperature"] = temperature;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    const ra = Number(res.headers.get("Retry-After"));
    throw new GatewayError(
      "The AI service is rate limited right now.",
      429,
      true,
      Number.isFinite(ra) && ra > 0 ? ra : null,
    );
  }
  if (res.status === 402)
    throw new GatewayError("AI credits are exhausted for this workspace. Add credits and try again.", 402, false);
  if (res.status === 403)
    throw new GatewayError("AI access is blocked by a workspace policy or limit.", 403, false);
  if (res.status === 400)
    throw new GatewayError(
      `The selected model rejected the request: ${(await res.text()).slice(0, 300)}`,
      400,
      false,
    );
  if (!res.ok)
    throw new GatewayError(
      `The AI service returned ${res.status}: ${(await res.text()).slice(0, 300)}`,
      res.status,
      res.status >= 500,
    );
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new GatewayError("The AI service returned an empty response.", 502, true);
  return content;
}

/**
 * Calls the model, transparently retrying transport failures (429 / 5xx) with backoff.
 * Terminal statuses (400/401/402/403) throw immediately — they never improve on retry.
 */
async function callModel(
  messages: { role: string; content: string }[],
  model: string,
  temperature: number,
): Promise<string> {
  let lastErr: unknown;
  for (let transportTry = 1; transportTry <= 3; transportTry++) {
    try {
      return await callModelOnce(messages, model, temperature);
    } catch (err) {
      lastErr = err;
      const g = err as GatewayError;
      if (!(g instanceof GatewayError) || !g.retryable || transportTry === 3) throw err;
      const waitMs = g.retryAfterSeconds ? g.retryAfterSeconds * 1000 : 1500 * transportTry + Math.random() * 500;
      await sleep(waitMs);
    }
  }
  throw lastErr as Error;
}

/** Per-error "how to fix" guidance so repair rounds are targeted instead of a blind rewrite. */
function repairHint(error: string): string | null {
  const e = error.toLowerCase();
  if (e.includes("not listed in meta.subscales"))
    return "add the missing subscale to meta.subscales, or change the item's subscale to one that is already listed — the two lists must match exactly, including capitalisation";
  if (e.includes("interpretation.per_subscale is missing"))
    return "add one interpretation entry per subscale in meta.subscales, each with text for every band name used in scoring.subscale_scores.ranges";
  if (e.includes("attention check") || e.includes("is_attention_check"))
    return "include at least one item with is_attention_check=true and a numeric expected_answer inside the response scale, or set scoring.validity_check.enabled=false";
  if (e.includes("results") && (e.includes("style") || e.includes("invalid option")))
    return `visuals.results.style must be EXACTLY one of ${RESULTS_STYLES.join(" | ")} (lowercase, no other words); radar needs 3+ subscales`;
  if (e.includes("hex color") || e.includes("gradient") || e.includes("accent"))
    return "every colour must be a 6-digit hex string starting with # (e.g. #1B2A4A) — no colour names, rgb() or 8-digit values";
  if (e.includes("visuals"))
    return "include the complete visuals block: icon {type,value,style}, banner {gradient:[hex,hex],pattern,accent,caption}, results {style,theme,description}";
  if (e.includes("labels"))
    return "instructions.response_scale.labels needs one string label for EVERY integer from min to max, keyed as strings";
  if (e.includes("ranges"))
    return "define at least two bands, use the SAME band names in scoring.subscale_scores.ranges, scoring.overall_score.ranges, interpretation.per_subscale and interpretation.overall, and keep min/max consistent with the response scale and scoring.method";
  if (e.includes("disclaimer"))
    return 'rewrite interpretation.disclaimer with non-clinical wording — never "diagnose", "treat", "cure" or "confirm"; use "indicates a tendency / invites reflection"';
  if (e.includes("item ids"))
    return "give every item a unique id such as q01, q02, q03";
  if (e.includes("expected") && e.includes("array"))
    return "that field must be a JSON array";
  return null;
}

function buildRepairMessage(errors: string[], strict: boolean): string {
  const lines = errors.slice(0, 25).map((err) => {
    const hint = repairHint(err);
    return hint ? `- ${err}\n  → fix: ${hint}` : `- ${err}`;
  });
  return (
    `Your JSON is close, but these exact validation errors remain:\n${lines.join("\n")}\n\n` +
    `Fix ONLY these problems. Keep every other field byte-identical — do not rewrite the items, ` +
    `rename subscales, or change the construct.` +
    (strict
      ? ` This is the last chance: be literal, re-read the schema, and double-check band names and enum spellings before answering.`
      : "") +
    ` Return ONLY the complete corrected JSON object, no prose and no code fences.`
  );
}

export type GenerationStage =
  | { kind: "drafting"; attempt: number; model: string }
  | { kind: "validating"; attempt: number }
  | { kind: "repairing"; attempt: number; errors: string[] };

const FALLBACK_MODEL = "openai/gpt-5.4";

/**
 * Generates a spec with escalating self-repair rounds:
 * 1 draft → 2 targeted repair → 3 targeted repair at low temperature → 4 repair on a fallback model.
 * Mechanical problems are fixed locally by `coerceSpec` before each validation pass, so the model
 * only ever has to fix things that genuinely need judgement.
 */
export async function generateSpec(opts: {
  request: string;
  pathHint: string;
  model: string;
  temperature: number;
  onStage?: (stage: GenerationStage) => void | Promise<void>;
}): Promise<{ spec: TestSpec; attempts: number; history: string[][] }> {
  const { coerceSpec } = await import("./spec-coerce");
  const userPrompt = MASTER_PROMPT + opts.request + pathDirective(opts.pathHint);
  const messages: { role: string; content: string }[] = [{ role: "user", content: userPrompt }];
  const history: string[][] = [];
  const MAX_ATTEMPTS = 4;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const model = attempt === MAX_ATTEMPTS && opts.model !== FALLBACK_MODEL ? FALLBACK_MODEL : opts.model;
    const temperature = attempt >= 3 ? Math.min(opts.temperature, 0.2) : opts.temperature;
    await opts.onStage?.({ kind: "drafting", attempt, model });

    let text: string;
    try {
      text = await callModel(messages, model, temperature);
    } catch (err) {
      const gateway = err as GatewayError;
      // Terminal gateway failures never improve with another attempt.
      if (gateway instanceof GatewayError && !gateway.retryable) {
        (gateway as Error & { details?: string[] }).details = history.flat();
        throw gateway;
      }
      history.push([(err as Error).message]);
      if (attempt === MAX_ATTEMPTS) throw err;
      continue;
    }

    await opts.onStage?.({ kind: "validating", attempt });

    let candidate: unknown;
    try {
      candidate = extractJson(text);
    } catch (err) {
      const parseError = (err as Error).message;
      history.push([parseError]);
      if (attempt === MAX_ATTEMPTS) break;
      messages.push({ role: "assistant", content: text.slice(0, 4000) });
      messages.push({
        role: "user",
        content: `Your output could not be parsed as JSON: ${parseError}. Return ONLY one complete JSON object — no prose, no fences, no trailing commas.`,
      });
      continue;
    }

    candidate = coerceSpec(candidate);
    const { spec, errors } = validateSpec(candidate, { requireVisuals: true });
    if (spec) return { spec, attempts: attempt, history };

    history.push(errors);
    if (attempt === MAX_ATTEMPTS) break;
    await opts.onStage?.({ kind: "repairing", attempt: attempt + 1, errors });
    messages.push({ role: "assistant", content: JSON.stringify(candidate).slice(0, 14000) });
    messages.push({ role: "user", content: buildRepairMessage(errors, attempt >= MAX_ATTEMPTS - 1) });
  }

  const lastErrors = history[history.length - 1] ?? [];
  const err = new Error(`The model could not produce a schema-valid spec after ${MAX_ATTEMPTS} attempts.`);
  (err as Error & { details?: string[] }).details = lastErrors;
  throw err;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeAccessCode(): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

const VISUALS_PROMPT = `You are an art director for psychometric instruments. Given a test summary,
return ONLY a JSON object (no prose, no fences) with this exact shape:
{"icon":{"type":"emoji|svg","value":"single emoji or inline <svg>...</svg>","style":"short design description"},
 "banner":{"gradient":["#112233","#445566"],"pattern":"waves|dots|grid|mountains|stars|none","accent":"#77AABB","caption":"one-line concept for the banner art"},
 "results":{"style":"radar|gauges|bars|rings|terrain|constellation","theme":"visual metaphor tying the chart to the construct","description":"how subscale + overall scores map onto the visual and how low/moderate/high bands are distinguished"}}
Rules: colors are 6-digit hex; results.style is EXACTLY one of ${RESULTS_STYLES.join(" | ")};
use radar only when there are 3 or more subscales; keep the art direction coherent with the construct.

TEST SUMMARY:
`;

/** Generates just the visuals block from a spec summary (icons/banner/results style). */
export async function generateVisualsBlock(opts: {
  summary: string;
  model: string;
  temperature: number;
}): Promise<TestVisuals> {
  const messages: { role: string; content: string }[] = [
    { role: "user", content: VISUALS_PROMPT + opts.summary },
  ];
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const text = await callModel(messages, opts.model, opts.temperature);
    let candidate: unknown;
    try {
      candidate = extractJson(text);
    } catch (err) {
      lastError = (err as Error).message;
      messages.push({ role: "assistant", content: text.slice(0, 2000) });
      messages.push({ role: "user", content: `That could not be parsed: ${lastError}. Return ONLY the JSON object.` });
      continue;
    }
    const parsed = visualsSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
    lastError = parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
    messages.push({ role: "assistant", content: JSON.stringify(candidate).slice(0, 2000) });
    messages.push({
      role: "user",
      content: `Your JSON failed validation: ${lastError}. Fix it and return ONLY the corrected JSON object.`,
    });
  }
  throw new Error(`The model could not produce a valid visuals block: ${lastError}`);
}

/** Compact spec summary sent to the visuals model (meta + item gist + scoring). */
export function summariseSpecForVisuals(spec: TestSpec): string {
  return JSON.stringify({
    meta: spec.meta,
    title: spec.instructions.title,
    scale: spec.instructions.response_scale,
    scoring: { method: spec.scoring.method, bands: Object.keys(spec.scoring.subscale_scores.ranges) },
    subscale_count: spec.meta.subscales.length,
    sample_items: spec.items.slice(0, 8).map((i) => ({ text: i.text, subscale: i.subscale })),
  });
}
