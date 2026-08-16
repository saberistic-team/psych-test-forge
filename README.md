# Psych Lab

# Lovable Build Prompt — "Psych Lab" (Paid SaaS Edition)




Paste everything below into Lovable to build the app.




---




## 1. PRODUCT OVERVIEW




Build **Psych Lab**, a SaaS web app that lets **creators** generate professional psychological tests with AI and publish them to **participants**, who take the tests and get scored results. This is a **monetized** version — both creators and participants pay for premium features. Lovable full-stack: React + TypeScript + Tailwind, Supabase (auth, Postgres, RLS, Edge Functions), Stripe for payments.




The core value: an AI **test generator** that produces complete, valid psychological questionnaires with a rigorous JSON schema, a **scoring engine** that turns answers into subscale + overall scores with interpretation bands, and clean flows for publishing, joining, taking, and reporting.




There are **three actor roles**:




1. **App owner / Admin** — the SaaS operator. Controls the platform, sees all creators and their revenue usage, sets feature limits, manages the LLM API connection.

2. **Creator** — pays for the ability to generate and publish tests. Generates tests with AI, edits/publishes them, gives participants a join code, and views attempts/aggregates.

3. **Participant / end user** — joins with a code, completes a questionnaire, and receives scored results (free basic, paid premium report).




---




## 2. CORE TEST-GENERATION MECHANICS




The generator must implement **exactly two decision paths**:




- **PATH A — Established test:** When the creator names an existing instrument (e.g. "BDI-II", "Big Five", "GAD-7") or asks to "pick a well-known test", the AI reproduces it, preserves its response scale and scoring bands, cites originators/year, marks `fidelity` as `exact` or `reconstructed`, and shows a licensing caution if commercial use is likely.

- **PATH B — Novel test:** When the creator describes an open construct/angle with no named instrument, the AI **decides its own construct** from that angle (e.g. "digital serenity", "decision fatigue"), anchors it in a recognized theory, designs 3–6 named subscales, 18–40 Likert items (min 10), includes reverse-scored items and at least one **attention/validity check item**, and defines interpretation bands.




Both paths produce one **JSON spec** conforming to the schema in §4. Generation runs asynchronously (can take minutes), with a visible progress/polling UI, and must include a **self-repair loop**: if the emitted JSON fails schema validation, send it back to the model with the exact validation errors up to 2 more times until it passes. Never show a hard failure without also showing the error list and offering a retry with a different temperature.




Also support **importing a spec JSON** (paste or upload) so creators can bring in tests from elsewhere.




---




## 3. MONETIZATION (IMPORTANT — DESIGN AROUND THIS)




### Creator plans (subscription, billed via Stripe)




| Plan | Price | Features |

|---|---|---|

| Free | $0 | 2 AI generations/month, drafts only (cannot publish), watermarked results, 5 participant attempts/month, community attribution |

| Pro | $19/mo | 50 generations/month, publish unlimited tests, 500 attempts/month, PDF report export, custom branding, priority generation queue |

| Business | $79/mo | Unlimited generations, 10,000 attempts/month, full white-label, team seats (5), license-clearance advice for established tests, CSV/API export of results |




Each plan has a hard feature matrix. When a creator hits a limit (e.g. no generations left), show an inline upsell card listing what upgrading unlocks, and route to Stripe Checkout. Track usage in a `usage_metering` table with per-month counters reset on the billing cycle.




### Participant purchases




- **Free:** basic result page — subscale names + score numbers + band label.

- **Premium report — one-time unlock per test** (e.g. $2.99): full narrative interpretations per subscale, comparison to cohort average, PDF export, printable certificate, and save-to-history.

- **Participant subscription** (e.g. $9/mo "Results+") when premium exists: unlimited premium reports, full score history with trend charts, retake unlimited, early access.




Every participant is anonymous-until-paid; identify them by a `participant_id` (device/persistent) and store PII minimal (name only).




Payments must be Stripe with webhooks handling `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, and `customer.subscription.deleted`. Use Stripe Customer Portal for subscription management. Add `is_premium` computed via a `subscriptions` table joined against the payment webhook state — never trust client-side flags.




---




## 4. TEST SPEC JSON SCHEMA (the contract between generator, DB, and scoring engine)




```json

{

"meta": {

"schema_version": "1.0",

"path": "established" | "novel",

"decision_path": "string",

"construct": "string",

"construct_rationale": "string (novel only)",

"established_test_name": "string|null",

"fidelity": "exact" | "reconstructed" | null,

"fidelity_note": "string",

"theory_framework": "string",

"subscales": ["string"],

"references": ["string"],

"target_population": "string",

"time_to_complete_minutes": "number"

  },

"instructions": {

"title": "string",

"prompt_text": "string",

"response_scale": {

"type": "likert", "min": 1, "max": 5,

"labels": {"1": "label", "2": "label", "3": "label", "4": "label", "5": "label"}

    }

  },

"items": [

    {

"id": "q01",

"text": "string",

"subscale": "string (must be in meta.subscales)",

"reverse_scored": true|false,

"is_attention_check": false,

"expected_answer": null|number

    }

  ],

"scoring": {

"method": "sum" | "mean",

"reverse_logic": "new = (max + min) - raw",

"subscale_scores": {

"calc": "mean of subscale item scores",

"ranges": {"low": {"min": 1.0, "max": 2.4}, "moderate": {"min": 2.5, "max": 3.4}, "high": {"min": 3.5, "max": 5.0}}

    },

"overall_score": {

"enabled": true|false,

"calc": "mean of all non-attention items",

"ranges": {"low": {...}, "moderate": {...}, "high": {...}}

    },

"validity_check": {"enabled": true, "rule": "string", "action": "warn" | "invalidate"}

  },

"interpretation": {

"per_subscale": {"SUBSCALE": {"low": "string", "moderate": "string", "high": "string"}},

"overall": {"low": "string", "moderate": "string", "high": "string"},

"disclaimer": "string (non-clinical wording required)"

  },

"administration": {

"instructions_for_admin": "string",

"scoring_instructions": "string",

"report_template": "string"

  }

}

```




### Scoring engine rules (implement exactly)




1. Responses map by item `id`.

2. Reverse scoring: `score = (max + min) - raw` for `reverse_scored` items. Never reverse attention-check items.

3. Subscale score = sum or mean (per `scoring.method`) of that subscale's scored items.

4. Overall score = mean/sum of all non-attention scored items (if `overall_score.enabled`).

5. Band = first band in `ranges` whose `[min, max]` contains the score; if in a gap, clamp to nearest band.

6. Validity: any attention item whose answer ≠ `expected_answer` → `validity.passed=false` with `action` = `warn` (still show scores, yellow banner) or `invalidate` (red banner, suppress overall score).

7. A response is invalid if any required item is missing or out of scale range → 422 with a per-item message.




---




## 5. DATA MODEL (Supabase Postgres)




- `profiles` — id (auth.users), role (`admin` | `creator`), name, org, plan, stripe_customer_id, billing_cycle.

- `llm_connections` — creator-owned API config (provider: openai | anthropic | ollama, base_url, api_key encrypted, model, default temperature). API keys MUST be stored server-side only and used in Edge Functions; never sent to the browser.

- `tests` — id, creator_id, slug, title, spec (jsonb), access_code (unique, 6-char uppercase, unambiguous alphabet), published, created_at, updated_at, deleted_at.

- `attempts` — id, test_id, participant_id, participant_name, responses (jsonb), scores (jsonb), validity, created_at.

- `premium_reports` — id, attempt_id, purchased, amount, created_at.

- `usage_metering` — id, creator_id, metric (`generations` | `attempts` | `pdf_exports`), period (yyyy-mm), value.

- `subscriptions` — id, user_id, plan, status, stripe_subscription_id, current_period_start/end.

- `pricing` — plan matrix reference table (feature limits).

- `generation_jobs` — id, creator_id, request, path_hint, model, temp, status (running/done/error), errors, test_id, created_at.




Access codes: generated server-side, guaranteed unique among published tests. RLS: creators only see their own tests/attempts/generation jobs; participants only read published test specs and write their own attempt; admin reads everything.




---




## 6. PAGES & FLOWS




**Public / marketing**

- Landing page with hero, how-it-works, **pricing tables** (creator plans + participant Results+), testimonials, FAQ.




**Auth**

- Sign up / sign in / reset password (Supabase Auth, email + magic link + Google OAuth).

- Onboarding: choose role (creator) → pick plan → Stripe Checkout.




**Creator dashboard**

- Overview: usage bars vs plan limits (generations used, attempts this month), revenue/attempts charts.

- **Generate test**: request textarea, path selector (Auto/Established/Novel), model + temperature pickers, Generate button. Live progress card that polls `generation_jobs`; on success shows the draft with "Open editor". On failure shows errors + "Retry with lower temperature". Also "Import spec JSON".

- **Test library**: table (title, path badge, subscales, item count, status Draft/Live, access code, attempts, actions). Drafts are private; Live tests are joinable.

- **Test editor**: left = form-ish preview of spec (title, construct, theory, subscales, scale, items grouped by subscale, attention items highlighted), right = raw JSON editor with validation errors inline and "Save". Buttons: Publish (assigns/regenerates code, shows the participant link `app.site/take/<CODE>` and the 6-char code), Unpublish, Delete (soft).

- **Results & analytics**: per test — attempts table (name, date, validity flag, subscale scores, overall), validity-failure rate, band distribution charts.

- **Billing**: current plan, usage, upgrade/downgrade via Customer Portal, invoices.

- **Settings**: LLM connection (provider, base URL, encrypted API key, model, default temp), branding (logo, colors), export data (CSV/JSON).




**Participant flows**

- `app.site/take` — join screen: enter code + name → loads test meta.

- `app.site/take/<CODE>` — deep link to a published test.

- **Take screen**: title, instructions, response-scale legend, items grouped by subscale with radio options, answered-counter progress, submit disabled until complete. Attention-check items marked but not labeled as such to the participant.

- **Results**: if free → basic scores. If premium unlocked → full interpretations, cohort comparison, PDF download button, certificate. Show a premium upsell card for the one-time unlock and the Results+ subscription. Always show the disclaimer banner.

- **History** (Results+ subscribers): past attempts with trend line per subscale.




**Admin console** (app owner)

- All creators, MRR, active subscriptions, platform-level LLM settings override, global feature flags, block/refund tools.




---




## 7. LLM INTEGRATION (server-side only)




- Implement in a Supabase Edge Function `generate-test`: builds the master prompt (see §8), calls the configured provider with `stream:false`, parses the response with a robust extractor (strip markdown fences, brace-balance), runs schema validation, and if it fails, calls the model again with the validation errors (self-repair, max 2 rounds).

- Support provider options: **OpenAI-compatible** (works with any API including a locally-hosted Ollama tunnel), Anthropic, or OpenAI. The default model field should pre-fill `gpt-5`/`claude-sonnet` for hosted, and mention that creators can point base_url at their own Ollama (`http://localhost:11434` via a tunnel) and set model `muse-glimmer:30b-mlx`.

- Never expose the API key to the client; store encrypted at rest; allow "test connection" button.




---




## 8. MASTER GENERATION PROMPT (embed verbatim in the Edge Function)




Use the following as the system/user prompt template, substituting the creator's request. The model must output ONLY the JSON spec (schema in §4):




```

You are an expert psychometrician and AI prompt engineer. Produce ONE valid,

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




User request: <INSERT REQUEST HERE>

```




---




## 9. DESIGN & UX DIRECTIONS




- Clean, calm, scientific aesthetic (like Headspace meets a research lab): soft off-white background, indigo/teal accent, rounded cards, subtle shadows, generous whitespace.

- Creator surfaces = dense but scannable tables + cards; participant surfaces = large, friendly, mobile-first questionnaire (radio rows tappable full-width).

- Loading states for every async action (generation spinner with elapsed time, payment redirects).

- Toasts for success/errors; inline form validation with clear messages.

- Responsive: participant flow must be flawless on phones; creator dashboard desktop-first but usable on tablet.

- Dark mode optional.




---




## 10. QUALITY BAR / ACCEPTANCE CRITERIA




1. Creator can: generate a test (both paths) → edit → publish → see join code + link → view attempts with scores.

2. Participant can: join with code → complete → see free results; unlock premium → PDF + certificate; see banner when attention check fails.

3. Limits are enforced by the pricing matrix (blocks + inline upsell); Stripe Checkout/Customer Portal round-trip works (test mode).

4. LLM failures show actionable errors and never crash; self-repair produces a schema-valid spec >90% of the time (test by generating 5 tests).

5. RLS verified: a participant cannot read other attempts, a creator cannot read other creators' tests.

6. No secrets in client code (audit for api_key).

7. Keyboard-accessible and responsive; Lighthouse > 90 on participant flow.

```




---




### Lovable implementation notes (do NOT include in the pasted prompt)




- Paste everything between the two `---` horizontal rules into Lovable as the initial prompt, then iterate: Lovable's strongest loop is "click → comment → fix".

- Expect the first build to need a few correction rounds on: the Edge Function prompt/repair loop, Stripe webhook wiring (use Lovable's Stripe integration, but re-check `invoice.paid` handling), and RLS policies.

- If you want to keep using your local `muse-glimmer:30b-mlx`: expose it with a tunnel (e.g. ngrok/cloudflared to `localhost:11434`) and use the OpenAI-compatible provider setting with `base_url=https://<tunnel>/v1`.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://psych-test-forge.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/298f3c01-e196-469a-a396-85466e008ab8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
