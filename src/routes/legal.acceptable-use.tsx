import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/acceptable-use")({
  head: () => ({
    meta: [
      { title: "AI Use & No Automated Decisions — Psych Lab" },
      {
        name: "description",
        content:
          "How Psych Lab's AI features may and may not be used: no automated decisions about people, no clinical, diagnostic, employment or professional-advice use, human review required.",
      },
      { property: "og:title", content: "AI Use & No Automated Decisions — Psych Lab" },
      {
        property: "og:description",
        content:
          "Psych Lab is a self-reflection and research tool. It does not make or influence decisions about individuals and is not a professional service.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcceptableUsePage,
});

function AcceptableUsePage() {
  return (
    <article>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">AI Use &amp; No Automated Decisions Policy</h1>
      <p className="mt-2 text-xs text-muted-foreground">Last updated 16 August 2026</p>

      <h2>1. What Psych Lab is</h2>
      <p>
        Psych Lab is authoring software. It helps a creator draft a self-report questionnaire with AI assistance, edit
        it, publish it behind a join code, and display arithmetic scores back to the person who answered. It is a
        content-creation and self-reflection tool for research, education and entertainment.
      </p>

      <h2>2. Psych Lab does not make or influence decisions about people</h2>
      <p>
        Psych Lab produces no recommendations, ratings, eligibility outcomes, risk scores or profiles that are intended
        to be acted upon by a third party about an individual. Specifically:
      </p>
      <ul>
        <li>
          There is no automated decision-making and no profiling within the meaning of Article 22 GDPR. No output of the
          platform decides, approves, denies, ranks, screens or prices anything for any person.
        </li>
        <li>
          Scores are deterministic arithmetic over answers the person voluntarily gave about themselves (sum or mean of
          a response scale, with reverse-scored items). The AI writes question wording and descriptive text only — it
          does not evaluate an individual.
        </li>
        <li>
          Results are shown to the person who answered. Creators see aggregate and per-attempt answer data for their own
          research purposes; the platform never instructs or enables them to take a consequential action about a
          participant.
        </li>
      </ul>

      <h2>3. Prohibited uses</h2>
      <p>
        You must not use Psych Lab, or any test or output produced with it, for any of the following. Accounts doing so
        are suspended.
      </p>
      <ul>
        <li>
          <strong>Decisions about a natural person</strong> — hiring, promotion, firing, admissions, tenancy, credit,
          insurance, benefits, immigration, custody, sentencing, policing, or any other decision affecting a person's
          rights, access to services, or legal status.
        </li>
        <li>
          <strong>Clinical, diagnostic or medical use</strong> — screening, triage, diagnosis, treatment planning,
          therapy substitution, suicide or self-harm risk assessment, or any use in a healthcare pathway.
        </li>
        <li>
          <strong>Regulated professional services</strong> — providing psychological, medical, legal, financial,
          educational-placement or other regulated advice to a client, or presenting Psych Lab output as the work of a
          licensed professional.
        </li>
        <li>
          <strong>Assessment of people who cannot consent</strong> — minors without verified guardian consent, or anyone
          assessed without their knowledge.
        </li>
        <li>
          <strong>Misrepresentation</strong> — claiming a generated instrument is validated, normed, licensed, clinically
          approved or endorsed when it is not.
        </li>
      </ul>

      <h2>4. Human review is required</h2>
      <p>
        Every AI-generated instrument is a draft. The creator is the author and publisher of the test: they must read,
        edit and approve the items, scoring and interpretation text before publishing, and they remain responsible for
        the scientific and ethical suitability of what they publish. AI output is never published automatically without a
        creator's explicit action.
      </p>

      <h2>5. No advice, no guarantee of accuracy</h2>
      <p>
        AI-generated items, bands and narrative text may be inaccurate, incomplete or psychometrically unvalidated.
        Nothing on Psych Lab is medical, psychological, legal, financial or other professional advice, and nothing should
        be relied upon as such. If you have a health concern, speak to a qualified professional.
      </p>

      <h2>6. Enforcement</h2>
      <p>
        We may filter or refuse AI outputs, remove or unlist tests, and suspend or terminate accounts that breach this
        policy or our <a href="/legal/terms">Terms &amp; Conditions</a>. Report misuse or an allegedly infringing test
        through the contact route on this site.
      </p>
    </article>
  );
}
