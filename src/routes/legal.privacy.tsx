import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — Psych Lab" },
      {
        name: "description",
        content:
          "How Psych Lab collects, uses, shares and retains personal data from creators and test participants, and the rights you have over it.",
      },
      { property: "og:title", content: "Privacy Notice — Psych Lab" },
      {
        property: "og:description",
        content: "What data Psych Lab collects from creators and participants, why, and how long we keep it.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <article>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Privacy Notice</h1>
      <p className="mt-2 text-xs text-muted-foreground">Last updated 16 August 2026</p>

      <h2>1. Who we are</h2>
      <p>
        <strong>Psych Lab</strong> operates this platform and is the <strong>data controller</strong> for the personal
        data described below — that is, we decide what data is collected through Psych Lab and why. Where a creator
        publishes a test and collects responses from their own participants, that creator determines the purpose of
        their study and acts as controller for those responses; we process them on the creator's behalf as part of
        providing the platform.
      </p>

      <h2>2. Data we collect and why</h2>
      <ul>
        <li>
          <strong>Account data</strong> (name, email address, organisation, authentication identifiers from
          email/password or Google sign-in) — to create and secure your account and identify you when you sign in.
          Legal basis: performance of our contract with you.
        </li>
        <li>
          <strong>Content you create</strong> (test titles, generation prompts, test specifications, items, scoring
          rules, join codes) — to provide the generation, publishing and scoring features. Legal basis: contract.
        </li>
        <li>
          <strong>Participant responses and scores</strong> (answers to items, computed scores, validity indicators, an
          optional display name, and a randomly generated participant identifier stored in your browser) — to score the
          test, show results, and give the creator aggregate analytics. Legal basis: contract, and where a creator
          collects sensitive information, the consent the creator obtains from participants.
        </li>
        <li>
          <strong>Usage and plan data</strong> (generation and attempt counters, plan tier, subscription status,
          purchase unlock records) — to enforce plan limits and provide billing features. Legal basis: contract and our
          legitimate interest in operating the service.
        </li>
        <li>
          <strong>Technical and security data</strong> (IP address, device and browser information, log and error data)
          — to keep the service secure, prevent fraud and abuse, and diagnose faults. Legal basis: legitimate
          interests.
        </li>
        <li>
          <strong>Support messages</strong> — to answer your questions. Legal basis: contract and legitimate interests.
        </li>
        <li>
          <strong>Marketing communications</strong>, only where you have opted in. Legal basis: consent, which you can
          withdraw at any time.
        </li>
      </ul>
      <p>
        We do not ask participants for information beyond what the test they are taking requires. Please avoid entering
        identifying details in free-text answers unless the creator has asked for them.
      </p>

      <h2>3. AI processing</h2>
      <p>
        Generation prompts and draft test content are sent to our AI model provider so that a draft instrument can be
        produced. We do not send participant responses to AI providers for model training.
      </p>

      <h2>4. Who we share data with</h2>
      <ul>
        <li>
          <strong>Service providers and subprocessors</strong> — hosting, database, authentication, AI model inference,
          error monitoring and support tooling, acting under contract on our instructions.
        </li>
        <li>
          <strong>Paddle</strong>, our Merchant of Record, for the sale of our products, subscription management,
          payment processing, tax compliance and invoicing.
        </li>
        <li>
          <strong>Test creators</strong> — a creator can see the responses, scores and any display name submitted to
          their own test.
        </li>
        <li>
          <strong>Professional advisers</strong> (legal, accounting) where necessary.
        </li>
        <li>
          <strong>Authorities</strong> where we are required to disclose by law.
        </li>
      </ul>
      <p>We do not sell personal data.</p>

      <h2>5. International transfers</h2>
      <p>
        Our providers may process data outside your country, including outside the UK and EEA. Where that happens we
        rely on appropriate safeguards such as adequacy decisions or standard contractual clauses.
      </p>

      <h2>6. Retention</h2>
      <p>
        Account and content data are kept while your account is active. Deleted tests are retained briefly to allow
        recovery, then removed. Participant responses are kept for as long as the creator's test remains active, unless
        the creator deletes them sooner. Billing and tax records are kept for the period required by law. When data is
        no longer needed we delete or anonymise it.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access your data, correct it, delete it, restrict or
        object to processing, receive a portable copy, and withdraw consent where processing is based on consent. You
        can also complain to your data protection supervisory authority (in the UK, the Information Commissioner's
        Office). Contact us through the support route on this site and we will respond within one month.
      </p>

      <h2>8. Security</h2>
      <p>
        We use appropriate technical and organisational measures, including encryption in transit, row-level access
        controls in the database so creators can only reach their own data, restricted administrative access and audit
        logging. No system is perfectly secure, but we review these measures regularly.
      </p>

      <h2>9. Cookies and local storage</h2>
      <p>
        We use strictly necessary cookies and browser storage to keep you signed in, to remember a randomly generated
        participant identifier so you can return to your own results, and to protect against abuse. We do not use
        advertising cookies. You can clear this storage in your browser at any time, though doing so will sign you out
        and detach your local result history.
      </p>

      <h2>10. Changes</h2>
      <p>
        We will update this notice when our practices change and revise the date above. Material changes will be
        notified to account holders.
      </p>
    </article>
  );
}
