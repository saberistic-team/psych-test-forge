import { validateSpec, type TestSpec } from "./spec";

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
  interpretation, administration). Every item.subscale must be in meta.subscales.
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
  "administration": {"instructions_for_admin":"string","scoring_instructions":"string","report_template":"string"}
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

async function callModel(
  messages: { role: string; content: string }[],
  model: string,
  temperature: number,
): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The AI gateway is not configured for this project.");
  const body: Record<string, unknown> = { model, messages, stream: false };
  if (!model.startsWith("openai/gpt-5")) body["temperature"] = temperature;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("The AI service is rate limited right now. Please retry in a moment.");
  if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
  if (!res.ok) throw new Error(`The AI service returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("The AI service returned an empty response.");
  return content;
}

/** Generates a spec with up to two self-repair rounds against the validation errors. */
export async function generateSpec(opts: {
  request: string;
  pathHint: string;
  model: string;
  temperature: number;
}): Promise<{ spec: TestSpec; attempts: number }> {
  const userPrompt = MASTER_PROMPT + opts.request + pathDirective(opts.pathHint);
  const messages: { role: string; content: string }[] = [{ role: "user", content: userPrompt }];
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 3; attempt++) {
    let text: string;
    try {
      text = await callModel(messages, opts.model, opts.temperature);
    } catch (err) {
      if (attempt === 3) throw err;
      lastErrors = [(err as Error).message];
      continue;
    }

    let candidate: unknown;
    try {
      candidate = extractJson(text);
    } catch (err) {
      lastErrors = [(err as Error).message];
      messages.push({ role: "assistant", content: text.slice(0, 4000) });
      messages.push({
        role: "user",
        content: `Your output could not be parsed: ${lastErrors.join("; ")}. Return ONLY the corrected JSON object.`,
      });
      continue;
    }

    const { spec, errors } = validateSpec(candidate);
    if (spec) return { spec, attempts: attempt };
    lastErrors = errors;
    messages.push({ role: "assistant", content: JSON.stringify(candidate).slice(0, 12000) });
    messages.push({
      role: "user",
      content:
        `Your JSON failed schema validation with these exact errors:\n- ${errors.join("\n- ")}\n\n` +
        `Fix every error and return ONLY the complete corrected JSON object.`,
    });
  }
  const err = new Error("The model could not produce a schema-valid spec after 3 attempts.");
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
