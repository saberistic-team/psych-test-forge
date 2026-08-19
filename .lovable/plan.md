# New creator-side traffic opportunities

Goal: bring in more of the paying audience — people who author and list questionnaires (researchers, coaches, HR, educators) — rather than more respondents. The three saved ideas already in progress (public test pages, "what is the X test" explainers, Search Console) target respondents or plumbing, so these are different channels.

Current traffic is 74 visitors / 185 views in the last 30 days, almost all on `/` with no working search channel yet, so these are new-channel bets rather than optimizations of an existing one.

## 1. Free Likert scoring & reverse-scoring calculator

A public tool page at `/tools/likert-scoring-calculator`: paste items, flag reverse-scored ones, choose scale points, get sum/mean plus subscale totals. It reuses the scoring engine the app already has.

Why: "likert scale" and its variants draw tens of thousands of monthly US searches with low difficulty, and the people running that math are the ones who would author a questionnaire. The page also demonstrates the product's core mechanic for free.

Ends with a CTA: "Turn this into a shareable questionnaire" into the generator.

## 2. Questionnaire template gallery

Pilot five public template pages under `/templates/$slug`: employee engagement, course feedback, wellbeing check-in, customer satisfaction, team culture. Each shows the item list, response scale, scoring notes and score-range text, plus a "Use this template" button that seeds the builder.

Why: "questionnaire template", "survey template", "questionnaire examples" together carry thousands of monthly searches from exactly the authoring audience, and every template converts into a live listing.

## 3. Embeddable questionnaire widget with attribution

A copy-paste embed (iframe or small script) that lets a creator run one of their listed questionnaires on their own site, respecting existing paywall and access settings, with a "Powered by Psych Lab" link back.

Why: creators already publish on their own sites and newsletters; the attribution link earns referral traffic and inbound links from audiences that match the paying side. Needs one decision from you: should the attribution link be removable on paid tiers?

## Technical notes

- New public routes: `src/routes/tools.likert-scoring-calculator.tsx`, `src/routes/templates.tsx` + `src/routes/templates.$slug.tsx`, all with per-route `head()` (title, description, og:*, self-referencing canonical) and added to `src/routes/sitemap[.]xml.ts`.
- The calculator runs client-side against the existing `src/lib/scoring.ts` logic — no new tables, no data stored.
- Templates ship as static spec data validated by the existing `src/lib/spec.ts` schema, so "Use this template" reuses the current generator/import path instead of a new one.
- The embed needs a public render route plus frame-ancestor headers and reuse of the existing server-side access checks in `src/lib/participant.functions.ts`; it is the largest of the three and is best done after 1 and 2.

## Suggested order

Start with the calculator (smallest, fastest to rank), then the template pilot, then evaluate the embed.
