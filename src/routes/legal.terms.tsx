import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Psych Lab" },
      {
        name: "description",
        content:
          "The terms governing use of Psych Lab, the AI-assisted psychological test builder: licence, acceptable use, AI outputs, billing and termination.",
      },
      { property: "og:title", content: "Terms & Conditions — Psych Lab" },
      {
        property: "og:description",
        content: "Terms governing use of Psych Lab's AI-assisted test generation and assessment platform.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <article>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Terms &amp; Conditions</h1>
      <p className="mt-2 text-xs text-muted-foreground">Last updated 16 August 2026</p>

      <h2>1. Who you are contracting with</h2>
      <p>
        These terms are an agreement between you and <strong>Psych Lab</strong> ("Psych Lab", "we", "us"), the provider
        of the Psych Lab platform available at this website. By creating an account, taking a test, or otherwise
        continuing to use the service, you agree to these terms. If you do not agree, stop using the service.
      </p>
      <p>
        If you use Psych Lab on behalf of an organisation, you confirm you have authority to bind that organisation. If
        you use it as an individual, you confirm you are of legal age to enter into this agreement in your country.
      </p>

      <h2>2. What Psych Lab provides</h2>
      <p>
        Psych Lab is a software platform for building, publishing and administering self-report questionnaires. Creators
        can generate draft instruments with AI assistance, edit the resulting test specification, publish tests via a
        join code, and view aggregated results. Participants can complete published tests and view scored feedback.
      </p>
      <p>
        <strong>Psych Lab is not a diagnostic, clinical or medical service.</strong> Scores, bands and narrative
        interpretations are for research, education and self-reflection only. They are not a diagnosis, not a
        substitute for assessment by a qualified professional, and must not be used as the sole basis for clinical,
        employment, educational or other consequential decisions about a person.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>Provide accurate registration information and keep it up to date.</li>
        <li>Keep your credentials confidential; you are responsible for activity under your account.</li>
        <li>Tell us promptly if you believe your account has been compromised.</li>
      </ul>

      <h2>4. Licence and restrictions</h2>
      <p>
        We grant you a limited, non-exclusive, non-transferable right to use the service within the limits of the plan
        you have selected. You must not reverse engineer the service, resell or redistribute it, or circumvent plan
        limits, usage metering, access codes or other technical controls.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You must not misuse the service. In particular, you must not:</p>
      <ul>
        <li>use it for any unlawful purpose, or in breach of applicable research-ethics or data-protection rules;</li>
        <li>engage in fraud, spam, or deceptive recruitment of participants;</li>
        <li>infringe anyone's intellectual property, including reproducing copyrighted or licensed psychometric
          instruments you do not have the right to use;</li>
        <li>upload malware, probe or interfere with the security of the service, or scrape it by automated means;</li>
        <li>present Psych Lab output as a clinical diagnosis, or use it to screen individuals in a way that requires
          professional oversight you do not have.</li>
      </ul>

      <h2>6. AI-generated content</h2>
      <p>
        Psych Lab uses generative AI models to draft items, scoring rules and interpretation text. You are responsible
        for your prompts, for reviewing and verifying any generated instrument before publishing it, for its scientific
        and ethical suitability, and for holding the rights to any material you submit as input.
      </p>
      <ul>
        <li>Outputs may be inaccurate, incomplete or psychometrically unvalidated. Treat every generated instrument as
          a draft that requires expert review.</li>
        <li>Do not use the AI features to produce illegal content, harassment, hate speech, deceptive material,
          malware, or content that impersonates real people or established copyrighted instruments.</li>
        <li>Do not attempt to jailbreak, bypass or manipulate the model's safety behaviour.</li>
        <li>Where inputs or outputs are protected by intellectual property rights, those rights remain with the
          respective owner. As between us, you keep the rights in the content you submit, and you may use outputs you
          generate for your own lawful purposes.</li>
        <li>Rights-holders may report allegedly infringing content to us using the contact route on this site; we will
          review and remove content where appropriate, and may terminate accounts for repeat infringement.</li>
        <li>We may moderate content: we can filter or refuse outputs, remove or restrict content, and suspend accounts
          that breach this section.</li>
      </ul>

      <h2>7. Intellectual property</h2>
      <p>
        We retain all ownership of the Psych Lab platform and its intellectual property, including its software,
        scoring engine, documentation, design and branding. You grant us a limited licence to host and process the
        content you submit (test specifications, responses, account data) solely to provide and support the service.
      </p>

      <h2>8. Service availability and warranties</h2>
      <p>
        We aim for a reliable service but do not guarantee uninterrupted, timely, secure or error-free operation.
        Features may change as the product evolves. To the fullest extent permitted by law, we disclaim all implied
        warranties, including merchantability, fitness for a particular purpose and non-infringement.
      </p>

      <h2>9. Payments, subscriptions and refunds</h2>
      <p>
        Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all
        our orders. Paddle provides all customer service inquiries and handles returns.
      </p>
      <p>
        Payment, billing frequency, applicable taxes, currency, renewals, cancellations and refund mechanics are
        governed by{" "}
        <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noreferrer noopener">
          Paddle's Checkout Buyer Terms
        </a>
        . Subscriptions renew automatically for the interval you selected until cancelled. You can cancel at any time
        from your billing page or the Paddle customer portal; paid features remain available until the end of the
        period you have already paid for, after which the account returns to the Free plan. See our{" "}
        <a href="/legal/refunds">Refund Policy</a> for our money-back guarantee.
      </p>

      <h2>10. Suspension and termination</h2>
      <p>
        We may suspend or terminate access for material breach of these terms, non-payment, a security or fraud risk,
        or repeated or serious policy violations. You may stop using the service at any time. On termination, your
        licence ends; you can request an export of your tests and results for a reasonable period before we delete or
        anonymise the data in line with our <a href="/legal/privacy">Privacy Notice</a>.
      </p>

      <h2>11. Liability</h2>
      <p>
        To the fullest extent permitted by law, our aggregate liability arising out of or relating to the service is
        limited to the fees you paid us in the 12 months before the event giving rise to the claim. We are not liable
        for indirect, consequential or special damages, including lost profits, lost data or loss of goodwill. Nothing
        in these terms excludes liability for fraud, death or personal injury caused by negligence, or any other
        liability that cannot lawfully be excluded.
      </p>
      <p>
        You will indemnify us against claims arising from your content, your unlawful or unethical use of the service,
        your use of AI outputs, or your breach of these terms.
      </p>

      <h2>12. General</h2>
      <p>
        You may not assign this agreement without our consent; we may assign it in connection with a merger,
        acquisition or sale of assets. Neither party is liable for delays caused by events beyond its reasonable
        control. These terms are governed by the laws of the jurisdiction in which Psych Lab is established, and
        disputes will be heard by the courts of that jurisdiction. If we change these terms, we will update the date
        above and, for material changes, notify account holders.
      </p>
    </article>
  );
}
