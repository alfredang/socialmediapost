import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/LegalShell";

export const metadata = {
  title: "Privacy Policy — SocialPost",
  description: "How SocialPost collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 23, 2026">
      <LegalSection heading="1. Overview">
        <p>
          SocialPost (&quot;we&quot;, &quot;us&quot;) is a social media publishing platform that
          lets you post content to third-party social networks from one dashboard and API. This
          policy explains what data we collect, why we collect it, and the choices you have. We
          collect only what the service needs to work — we do not sell personal data and we do not
          run advertising.
        </p>
      </LegalSection>

      <LegalSection heading="2. Data we collect">
        <p>
          <strong className="text-slate-800 dark:text-slate-300">Account data.</strong> Your email
          address, name, and a securely hashed password when you register, plus plan and billing
          records if you subscribe.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-slate-300">Connected social accounts.</strong>{" "}
          When you connect a social network (TikTok, Instagram, Facebook, LinkedIn), we receive and
          store the account identifier, username/display name, and the OAuth access and refresh
          tokens the network issues. Tokens are used solely to publish content you request and to
          keep the connection alive. We never receive or store your social network passwords.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-slate-300">Content.</strong> The videos,
          photos, text, and documents you upload for publishing, and the resulting post records
          (status, links to published posts, errors).
        </p>
        <p>
          <strong className="text-slate-800 dark:text-slate-300">Usage data.</strong> API request
          logs (endpoint, method, status, timestamp) tied to your account for quota enforcement and
          troubleshooting.
        </p>
      </LegalSection>

      <LegalSection heading="3. How we use data">
        <p>We use the data above to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>publish, schedule, and queue content to the networks you choose;</li>
          <li>show you the status, history, and analytics of your posts;</li>
          <li>authenticate you and secure your account;</li>
          <li>enforce plan limits and prevent abuse;</li>
          <li>send transactional notifications you have enabled (e.g. publish results).</li>
        </ul>
        <p>We do not use your content or social account data for advertising or profiling, and we do not sell it to anyone.</p>
      </LegalSection>

      <LegalSection heading="4. Third-party platforms">
        <p>
          Publishing requires exchanging data with the social networks you connect. Content and
          captions you submit are transmitted to the selected networks via their official APIs
          (TikTok Content Posting API, Meta Graph API, LinkedIn API). Our use of data received from
          these platforms is limited to providing the publishing features you request and complies
          with each platform&apos;s developer terms, including{" "}
          <a
            href="https://developers.tiktok.com/terms"
            className="text-emerald-600 dark:text-emerald-400 underline transition-colors hover:text-emerald-700 dark:hover:text-emerald-300"
            target="_blank"
            rel="noopener"
          >
            TikTok&apos;s Developer Terms
          </a>
          , the Meta Platform Terms, and the LinkedIn API Terms of Use. Each network&apos;s own
          privacy policy governs the data it holds about you.
        </p>
      </LegalSection>

      <LegalSection heading="5. Cookies">
        <p>
          We use only essential cookies: a session cookie to keep you signed in and a preference for
          your light/dark theme. We do not use tracking or advertising cookies.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data retention and deletion">
        <p>
          Disconnecting a social account from the Users page deletes its stored tokens immediately.
          Deleting a profile deletes its posts and connected accounts. To delete your entire account
          and associated data, contact us via the{" "}
          <Link href="/support" className="text-emerald-600 dark:text-emerald-400 underline transition-colors hover:text-emerald-700 dark:hover:text-emerald-300">
            Help Center
          </Link>{" "}
          and we will complete the deletion within 30 days. You can also revoke SocialPost&apos;s
          access at any time from the connected network&apos;s own security settings.
        </p>
      </LegalSection>

      <LegalSection heading="7. Security">
        <p>
          All traffic to and from SocialPost and the platform APIs is encrypted in transit (HTTPS).
          Passwords are stored only as salted hashes. OAuth tokens are held server-side and are
          never exposed to your browser or to other users.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes and contact">
        <p>
          We will update this policy as the service evolves and change the date above when we do.
          Questions or requests can be sent through the{" "}
          <Link href="/support" className="text-emerald-600 dark:text-emerald-400 underline transition-colors hover:text-emerald-700 dark:hover:text-emerald-300">
            Help Center
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
