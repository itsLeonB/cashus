import { LegalPageLayout } from "@/components/LegalPageLayout";
import { Seo } from "@/components/Seo";
import { SUPPORT_EMAIL } from "@/lib/constants";

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout>
      <Seo
        title="Terms of Service"
        path="/terms-of-service"
        description="The terms and conditions for using Cashus."
      />
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: June 9, 2026
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
        <p className="text-sm leading-relaxed">
          By accessing or using Cashus, you agree to be bound by these Terms of
          Service. If you do not agree, do not use the service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">2. Description of Service</h2>
        <p className="text-sm leading-relaxed">
          Cashus is an expense-splitting and tracking application that helps
          users manage shared costs with friends and groups.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">3. User Accounts</h2>
        <p className="text-sm leading-relaxed">
          You are responsible for maintaining the security of your account
          credentials. You must provide accurate information when creating an
          account and keep it up to date.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">4. Acceptable Use</h2>
        <p className="text-sm leading-relaxed">You agree not to:</p>
        <ul className="list-disc list-inside text-sm space-y-1 pl-2">
          <li>Use the service for any unlawful purpose</li>
          <li>Attempt to gain unauthorized access to the service</li>
          <li>Interfere with or disrupt the service</li>
          <li>Upload malicious content or spam</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">5. Intellectual Property</h2>
        <p className="text-sm leading-relaxed">
          The Cashus service, including its design, features, and content, is
          owned by Cashus. You retain ownership of the data you input into the
          service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">6. Limitation of Liability</h2>
        <p className="text-sm leading-relaxed">
          Cashus is provided &quot;as is&quot; without warranties of any kind.
          We are not liable for any indirect, incidental, or consequential
          damages arising from your use of the service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">7. Termination</h2>
        <p className="text-sm leading-relaxed">
          We may suspend or terminate your account if you violate these terms.
          You may delete your account at any time.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">8. Changes to Terms</h2>
        <p className="text-sm leading-relaxed">
          We may update these terms from time to time. Continued use of the
          service after changes constitutes acceptance of the new terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">9. Contact Us</h2>
        <p className="text-sm leading-relaxed">
          If you have questions about these Terms, contact us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline hover:text-primary"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
