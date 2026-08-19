import { BANNER_PATTERNS, RESULTS_STYLES } from "./spec";

/**
 * Mechanical repair of a model-drafted spec before validation.
 *
 * Every fix here is deterministic and does not invent psychometric content — it only
 * normalises shapes the model routinely gets slightly wrong (hex colours, enum spellings,
 * band-name mismatches, unlisted subscales). Anything requiring judgement is left to the
 * model's repair round.
 */

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const STYLE_SYNONYMS: Record<string, string> = {
  spider: "radar",
  web: "radar",
  radarchart: "radar",
  gauge: "gauges",
  dial: "gauges",
  dials: "gauges",
  meter: "gauges",
  meters: "gauges",
  bar: "bars",
  barchart: "bars",
  columns: "bars",
  ring: "rings",
  donut: "rings",
  doughnut: "rings",
  circles: "rings",
  landscape: "terrain",
  mountains: "terrain",
  map: "terrain",
  stars: "constellation",
  star: "constellation",
  sky: "constellation",
};

const BAND_SYNONYMS: Record<string, string[]> = {
  low: ["low", "lower", "below average", "minimal", "weak"],
  moderate: ["moderate", "medium", "average", "mid", "middle", "typical"],
  high: ["high", "higher", "above average", "strong", "elevated"],
};

const CLINICAL_REPLACEMENTS: [RegExp, string][] = [
  [/\bdiagnoses\b/gi, "indicates"],
  [/\bdiagnosis\b/gi, "indication"],
  [/\bdiagnose\b/gi, "indicate"],
  [/\bdiagnostic\b/gi, "descriptive"],
  [/\btreats\b/gi, "addresses"],
  [/\btreat\b/gi, "address"],
  [/\bcures\b/gi, "supports"],
  [/\bcure\b/gi, "support"],
  [/\bconfirms\b/gi, "suggests"],
  [/\bconfirm\b/gi, "suggest"],
];

function normaliseHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  let v = value.trim().replace(/^["']|["']$/g, "");
  if (!v.startsWith("#")) v = `#${v}`;
  const body = v.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(body) || /^[0-9a-fA-F]{6}$/.test(body)) return `#${body.toUpperCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(body)) return `#${body.slice(0, 6).toUpperCase()}`;
  const rgb = value.match(/(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);
  if (rgb) {
    const hex = [rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0"))
      .join("");
    return `#${hex.toUpperCase()}`;
  }
  return fallback;
}

function bandKeyFor(key: string, targets: string[]): string | null {
  const k = key.trim().toLowerCase();
  const direct = targets.find((t) => t.trim().toLowerCase() === k);
  if (direct) return direct;
  for (const [canonical, words] of Object.entries(BAND_SYNONYMS)) {
    if (words.some((w) => k === w || k.includes(w))) {
      const match = targets.find((t) => {
        const tl = t.trim().toLowerCase();
        return tl === canonical || (BAND_SYNONYMS[canonical] ?? []).some((w) => tl === w || tl.includes(w));
      });
      if (match) return match;
    }
  }
  return null;
}

/** Renames the keys of a band-keyed record so they match the scoring band names. */
function alignBandKeys(record: unknown, targets: string[]): unknown {
  if (!isObj(record) || targets.length === 0) return record;
  const keys = Object.keys(record);
  if (keys.length === targets.length && keys.every((k) => targets.includes(k))) return record;
  const out: Obj = {};
  const used = new Set<string>();
  for (const key of keys) {
    const target = bandKeyFor(key, targets);
    if (target && !used.has(target)) {
      out[target] = record[key];
      used.add(target);
    } else {
      out[key] = record[key];
    }
  }
  // Positional fallback for leftovers when the counts line up.
  const missing = targets.filter((t) => !(t in out));
  const extras = Object.keys(out).filter((k) => !targets.includes(k));
  if (missing.length && missing.length === extras.length) {
    missing.forEach((t, i) => {
      const from = extras[i]!;
      out[t] = out[from];
      delete out[from];
    });
  }
  return out;
}

export function coerceSpec(input: unknown): unknown {
  if (!isObj(input)) return input;
  const spec: Obj = { ...input };

  // --- meta.subscales -------------------------------------------------------
  const meta = isObj(spec["meta"]) ? { ...(spec["meta"] as Obj) } : {};
  let subscales = Array.isArray(meta["subscales"])
    ? (meta["subscales"] as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  subscales = Array.from(new Set(subscales.map((s) => s.trim())));

  // --- items ----------------------------------------------------------------
  const scale = isObj(spec["instructions"]) && isObj((spec["instructions"] as Obj)["response_scale"])
    ? ((spec["instructions"] as Obj)["response_scale"] as Obj)
    : {};
  const scaleMin = typeof scale["min"] === "number" ? (scale["min"] as number) : 1;
  const scaleMax = typeof scale["max"] === "number" ? (scale["max"] as number) : 5;

  const seenIds = new Set<string>();
  let hasAttentionCheck = false;
  if (Array.isArray(spec["items"])) {
    spec["items"] = (spec["items"] as unknown[]).map((raw, index) => {
      if (!isObj(raw)) return raw;
      const item: Obj = { ...raw };
      // unique, non-empty ids
      let id = typeof item["id"] === "string" && item["id"].trim() ? item["id"].trim() : "";
      if (!id || seenIds.has(id)) id = `q${String(index + 1).padStart(2, "0")}`;
      while (seenIds.has(id)) id = `${id}_${index + 1}`;
      seenIds.add(id);
      item["id"] = id;
      // subscales the model forgot to declare are added rather than dropping the item
      if (typeof item["subscale"] === "string") {
        const sub = item["subscale"].trim();
        item["subscale"] = sub;
        const known = subscales.find((s) => s.toLowerCase() === sub.toLowerCase());
        if (known) item["subscale"] = known;
        else if (sub) subscales.push(sub);
      }
      if (item["is_attention_check"] === true) {
        hasAttentionCheck = true;
        const expected = item["expected_answer"];
        if (typeof expected !== "number") item["expected_answer"] = Math.round((scaleMin + scaleMax) / 2);
      }
      return item;
    });
  }
  if (subscales.length) meta["subscales"] = subscales;
  spec["meta"] = meta;

  // --- response scale labels ------------------------------------------------
  if (isObj(spec["instructions"])) {
    const instructions: Obj = { ...(spec["instructions"] as Obj) };
    const rs: Obj = isObj(instructions["response_scale"]) ? { ...(instructions["response_scale"] as Obj) } : {};
    rs["min"] = scaleMin;
    rs["max"] = scaleMax;
    if (typeof rs["type"] !== "string") rs["type"] = "likert";
    const labels: Record<string, string> = {};
    const existing = isObj(rs["labels"]) ? (rs["labels"] as Obj) : {};
    const generic = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
    for (let v = scaleMin; v <= scaleMax; v++) {
      const found = existing[String(v)];
      if (typeof found === "string" && found.trim()) labels[String(v)] = found;
      else {
        const span = Math.max(1, scaleMax - scaleMin);
        const pos = Math.round(((v - scaleMin) / span) * (generic.length - 1));
        labels[String(v)] = generic[pos] ?? `Level ${v}`;
      }
    }
    rs["labels"] = labels;
    instructions["response_scale"] = rs;
    spec["instructions"] = instructions;
  }

  // --- scoring --------------------------------------------------------------
  let bandNames: string[] = [];
  if (isObj(spec["scoring"])) {
    const scoring: Obj = { ...(spec["scoring"] as Obj) };
    if (scoring["method"] !== "sum" && scoring["method"] !== "mean") scoring["method"] = "mean";
    if (isObj(scoring["subscale_scores"])) {
      const sub = scoring["subscale_scores"] as Obj;
      if (isObj(sub["ranges"])) bandNames = Object.keys(sub["ranges"] as Obj);
    }
    if (isObj(scoring["overall_score"])) {
      const overall: Obj = { ...(scoring["overall_score"] as Obj) };
      if (typeof overall["enabled"] !== "boolean") overall["enabled"] = true;
      if (bandNames.length) overall["ranges"] = alignBandKeys(overall["ranges"], bandNames);
      scoring["overall_score"] = overall;
    }
    if (isObj(scoring["validity_check"])) {
      const vc: Obj = { ...(scoring["validity_check"] as Obj) };
      if (vc["enabled"] === true && !hasAttentionCheck) vc["enabled"] = false;
      if (vc["action"] !== "warn" && vc["action"] !== "invalidate") vc["action"] = "warn";
      scoring["validity_check"] = vc;
    }
    spec["scoring"] = scoring;
  }

  // --- interpretation -------------------------------------------------------
  if (isObj(spec["interpretation"])) {
    const interp: Obj = { ...(spec["interpretation"] as Obj) };
    if (bandNames.length) {
      interp["overall"] = alignBandKeys(interp["overall"], bandNames);
      if (isObj(interp["per_subscale"])) {
        const per: Obj = {};
        for (const [key, value] of Object.entries(interp["per_subscale"] as Obj)) {
          const known = subscales.find((s) => s.toLowerCase() === key.trim().toLowerCase()) ?? key;
          per[known] = alignBandKeys(value, bandNames);
        }
        interp["per_subscale"] = per;
      }
    }
    if (typeof interp["disclaimer"] === "string") {
      let d = interp["disclaimer"];
      for (const [re, rep] of CLINICAL_REPLACEMENTS) d = d.replace(re, rep);
      interp["disclaimer"] = d;
    }
    spec["interpretation"] = interp;
  }

  // --- visuals --------------------------------------------------------------
  if (isObj(spec["visuals"])) {
    const visuals: Obj = { ...(spec["visuals"] as Obj) };

    if (isObj(visuals["icon"])) {
      const icon: Obj = { ...(visuals["icon"] as Obj) };
      const value = typeof icon["value"] === "string" ? icon["value"].trim() : "";
      icon["value"] = value || "🧠";
      icon["type"] = String(icon["value"]).startsWith("<svg") ? "svg" : "emoji";
      if (typeof icon["style"] !== "string") icon["style"] = "";
      visuals["icon"] = icon;
    } else {
      visuals["icon"] = { type: "emoji", value: "🧠", style: "" };
    }

    const accentFallback = "#5B8DEF";
    if (isObj(visuals["banner"])) {
      const banner: Obj = { ...(visuals["banner"] as Obj) };
      const accent = normaliseHex(banner["accent"], accentFallback);
      banner["accent"] = accent;
      const gradientRaw = Array.isArray(banner["gradient"]) ? (banner["gradient"] as unknown[]) : [];
      const gradient = gradientRaw.slice(0, 3).map((c) => normaliseHex(c, accent));
      while (gradient.length < 2) gradient.push(gradient.length === 0 ? "#101828" : accent);
      banner["gradient"] = gradient;
      const pattern = typeof banner["pattern"] === "string" ? banner["pattern"].trim().toLowerCase() : "none";
      banner["pattern"] = (BANNER_PATTERNS as readonly string[]).includes(pattern) ? pattern : "none";
      if (typeof banner["caption"] !== "string") banner["caption"] = "";
      visuals["banner"] = banner;
    }

    if (isObj(visuals["results"])) {
      const results: Obj = { ...(visuals["results"] as Obj) };
      const rawStyle = typeof results["style"] === "string" ? results["style"].trim().toLowerCase() : "";
      const key = rawStyle.replace(/[\s_-]+/g, "");
      let style = (RESULTS_STYLES as readonly string[]).includes(rawStyle)
        ? rawStyle
        : (STYLE_SYNONYMS[key] ?? "bars");
      if (style === "radar" && subscales.length < 3) style = "bars";
      results["style"] = style;
      if (typeof results["theme"] !== "string") results["theme"] = "";
      if (typeof results["description"] !== "string") results["description"] = "";
      visuals["results"] = results;
    }

    spec["visuals"] = visuals;
  }

  return spec;
}
