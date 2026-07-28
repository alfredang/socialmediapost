import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/LegalShell";

export const metadata = {
  title: "Terms of Service — SocialPost",
  description: "The terms that govern your use of SocialPost.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 23, 2026">
      <LegalSection heading="1. Agreement">
        <p>
          These Terms of Service govern your use of SocialPost — the dashboard, the API, and any
          related tools (together, the &quot;Service&quot;). By creating an account or using the
          Service you agree to these terms. If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection heading="2. The Service">
        <p>
          SocialPost lets you publish, schedule, and analyze content across third-party social
          networks from one place. Publishing happens through each network&apos;s official API using
          accounts you connect and authorize. We do not guarantee that any given network will accept
          or continue to accept content — networks change their APIs, rules, and review requirements
          outside our control.
        </p>
      </LegalSection>

      <LegalSection heading="3. Your account">
        <p>
          You are responsible for the accuracy of your account information and for keeping your
          credentials and API keys confidential. Anything published through your account or API keys
          is treated as authorized by you. Notify us immediately via the{" "}
          <Link href="/support" className="text-emerald-600 dark:text-emerald-400 underline transition-colors hover:text-emerald-700 dark:hover:text-emerald-300">
            Help Center
          </Link>{" "}
          if you believe your account has been compromised.
        </p>
      </LegalSection>

      <LegalSection heading="4. Your content">
        <p>
          You retain all rights to the content you upload. You grant us a limited license to store,
          process, and transmit that content solely to provide the Service — for example, adapting a
          caption to a network&apos;s length limit and delivering your media to the networks you
          selected. We claim no ownership and do not use your content for any other purpose.
        </p>
        <p>You represent that you have the rights needed to publish the content you submit.</p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>publish content that is unlawful, infringing, deceptive, or harassing;</li>
          <li>send spam or engage in coordinated inauthentic behavior;</li>
          <li>violate the terms, community guidelines, or rate limits of any connected network;</li>
          <li>probe, disrupt, or overload the Service, or access it other than through documented interfaces;</li>
          <li>resell the Service without our written agreement (the whitelabel features are provided for this purpose under your plan).</li>
        </ul>
        <p>
          We may suspend or remove content or accounts that violate these rules or that a connected
          network requires us to act on.
        </p>
      </LegalSection>

      <LegalSection heading="6. Connected networks">
        <p>
          Connecting a social account authorizes SocialPost to publish to that account on your
          instruction until you disconnect it. Your use of each network remains governed by that
          network&apos;s own terms (including TikTok&apos;s Terms of Service and Community
          Guidelines, Meta&apos;s Terms, and LinkedIn&apos;s User Agreement). You can revoke access
          at any time from the Users page or from the network&apos;s security settings.
        </p>
      </LegalSection>

      <LegalSection heading="7. Plans and billing">
        <p>
          Paid plans are billed in advance on a monthly or yearly cycle and set the limits shown on
          the{" "}
          <Link href="/pricing" className="text-emerald-600 dark:text-emerald-400 underline transition-colors hover:text-emerald-700 dark:hover:text-emerald-300">
            Pricing
          </Link>{" "}
          page (profiles, API volume, features). Fees are non-refundable except where required by
          law. We may change pricing with notice effective from your next billing cycle.
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers and liability">
        <p>
          The Service is provided &quot;as is&quot; without warranties of any kind. To the maximum
          extent permitted by law, we are not liable for indirect, incidental, or consequential
          damages, or for loss of profits, data, or goodwill, arising from your use of the Service —
          including content rejected, removed, or restricted by a connected network. Our total
          liability for any claim is limited to the amount you paid us in the twelve months before
          the claim arose.
        </p>
      </LegalSection>

      <LegalSection heading="9. Termination">
        <p>
          You may stop using the Service and delete your account at any time. We may suspend or
          terminate access for breach of these terms, with notice where practicable. Sections 4, 8,
          and 10 survive termination.
        </p>
      </LegalSection>

      <LegalSection heading="10. General">
        <p>
          These terms are governed by the laws of Singapore, and disputes are subject to the
          exclusive jurisdiction of the courts of Singapore. If any provision is found
          unenforceable, the rest remain in effect. We may update these terms; material changes will
          be announced in the dashboard and take effect no earlier than 14 days after posting.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
