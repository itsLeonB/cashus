import { LegalPageLayout } from "@/components/LegalPageLayout";
import { Seo } from "@/components/Seo";
import { SUPPORT_EMAIL } from "@/lib/constants";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout>
      <Seo
        title="Privacy Policy"
        path="/privacy-policy"
        description="How Cashus collects, uses, and protects your information."
      />
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: June 9, 2026
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Information We Collect</h2>
        <p className="text-sm leading-relaxed">
          When you use Cashus, we collect information you provide directly,
          including your email address and password when you create an account,
          and your name and home currency during profile setup. If you sign in
          with Google, we receive your basic profile information (name, email,
          and profile picture) from Google.
        </p>
        <p className="text-sm leading-relaxed">
          We also collect usage data such as expense records, friend
          connections, and transfer methods you enter into the app.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          2. How We Use Your Information
        </h2>
        <p className="text-sm leading-relaxed">We use your information to:</p>
        <ul className="list-disc list-inside text-sm space-y-1 pl-2">
          <li>Provide and maintain the Cashus service</li>
          <li>Process and track shared expenses</li>
          <li>Send notifications about activity relevant to you</li>
          <li>Improve and personalize your experience</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">3. Information Sharing</h2>
        <p className="text-sm leading-relaxed">
          We do not sell your personal information. We share your information
          only with other Cashus users you interact with (e.g., friends you
          split expenses with) and service providers that help us operate the
          platform.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">4. Data Security</h2>
        <p className="text-sm leading-relaxed">
          We implement appropriate security measures to protect your personal
          information. However, no method of transmission over the Internet is
          100% secure.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">5. Data Retention</h2>
        <p className="text-sm leading-relaxed">
          We retain your data for as long as your account is active. You may
          request deletion of your account and associated data by contacting us.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">6. Your Rights</h2>
        <p className="text-sm leading-relaxed">
          You have the right to access, update, or delete your personal
          information. You can manage most of this through your profile settings
          or by contacting us.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">7. Contact Us</h2>
        <p className="text-sm leading-relaxed">
          If you have questions about this Privacy Policy, contact us at{" "}
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
