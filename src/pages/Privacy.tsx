import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const sections = [
  {
    title: "1. Introduction",
    content: `Gllarix ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI voice agent and business automation platform. We are the data controller for personal data processed through our Services. If you have questions about this policy, contact us at hello@gllarix.com.`,
  },
  {
    title: "2. Data Controller Information",
    content: `Gllarix\nPrishtinë, Kosovo (XKS)\nEmail: hello@gllarix.com\n\nAs a company serving customers in the European Union and globally, we comply with the General Data Protection Regulation (GDPR) and other applicable data protection laws. We process personal data only on lawful grounds as described in this policy.`,
  },
  {
    title: "3. Information We Collect",
    content: `We collect several types of information:\n\n• Account Data: Name, email address, company name, phone number, and billing information provided during registration.\n\n• Usage Data: Information about how you interact with our platform, including pages visited, features used, session duration, and technical logs.\n\n• Call & Automation Data: Transcripts, recordings, and metadata from AI voice agent interactions conducted through our platform on your behalf.\n\n• Communications: Emails, support tickets, and messages you send to us.\n\n• Cookie Data: See Section 10 (Cookies) for details.`,
  },
  {
    title: "4. How We Use Your Information",
    content: `We use the information we collect to:\n\n• Provide, operate, and maintain our Services\n• Process payments and manage your subscription\n• Send transactional emails and service notifications\n• Respond to your inquiries and provide customer support\n• Improve and develop new features for our platform\n• Monitor and analyze usage patterns to enhance user experience\n• Comply with legal obligations\n• Prevent fraud and ensure platform security`,
  },
  {
    title: "5. Legal Basis for Processing (GDPR Article 6)",
    content: `If you are in the European Economic Area (EEA), our legal bases for processing your personal data are:\n\n• Contract Performance: Processing necessary to provide the Services you have subscribed to.\n• Legitimate Interests: Analytics, security monitoring, and service improvement, where these interests are not overridden by your rights.\n• Legal Obligation: Compliance with applicable laws and regulations.\n• Consent: Where we have obtained your explicit consent, such as for marketing communications.`,
  },
  {
    title: "6. Data Sharing and Third Parties",
    content: `We do not sell your personal data. We may share your information with trusted third-party service providers only to the extent necessary to deliver our Services:\n\n• Resend: Used to send transactional and notification emails. Resend processes email content on our behalf under strict data processing agreements.\n• Payment Processors: For handling subscription billing securely.\n• Cloud Infrastructure Providers: For hosting and operating our platform.\n\nAll third parties are contractually obligated to protect your data and may only use it for the specific purposes we authorize.`,
  },
  {
    title: "7. Data Retention",
    content: `We retain your personal data only as long as necessary for the purposes described in this policy or as required by law. Account data is retained for the duration of your subscription and deleted within 90 days of account closure. Call recordings and transcripts are retained for 12 months by default unless you configure custom retention periods. Billing records are retained for 7 years for accounting and legal compliance. Anonymized and aggregated usage data may be retained indefinitely for analytics purposes.`,
  },
  {
    title: "8. Your Rights Under GDPR",
    content: `If you are in the EEA or UK, you have the following rights regarding your personal data:\n\n• Right of Access: Request a copy of the personal data we hold about you.\n• Right to Rectification: Request correction of inaccurate or incomplete data.\n• Right to Erasure: Request deletion of your personal data ("right to be forgotten").\n• Right to Restriction: Request that we restrict processing of your data in certain circumstances.\n• Right to Data Portability: Receive your data in a structured, commonly used, machine-readable format.\n• Right to Object: Object to processing based on legitimate interests or for direct marketing purposes.\n• Right to Withdraw Consent: Withdraw consent at any time where processing is based on consent.\n\nTo exercise any of these rights, contact us at hello@gllarix.com. We will respond within 30 days.`,
  },
  {
    id: "cookies",
    title: "9. Cookies and Tracking Technologies",
    content: `We use cookies and similar tracking technologies to operate our platform and improve your experience. The types of cookies we use include:\n\n• Essential Cookies: Required for the platform to function. These cannot be disabled.\n• Analytics Cookies: Help us understand how users interact with our platform (e.g., session duration, feature usage). These are anonymized where possible.\n• Preference Cookies: Remember your settings and preferences.\n\nYou can control cookie settings through your browser settings. Disabling certain cookies may affect the functionality of our Services. We do not use cookies for advertising or cross-site tracking.`,
  },
  {
    title: "10. International Data Transfers",
    content: `Gllarix operates from Kosovo and may process your data on servers located in the European Union or United States. When transferring personal data outside the EEA, we ensure adequate protections are in place, including Standard Contractual Clauses (SCCs) as approved by the European Commission, or other lawful transfer mechanisms. By using our Services, you consent to the transfer of your information to countries that may have different data protection laws than your country of residence.`,
  },
  {
    title: "11. Children's Privacy",
    content: `Our Services are not directed to individuals under the age of 18. We do not knowingly collect personal data from children. If you believe we have inadvertently collected information from a minor, please contact us immediately at hello@gllarix.com and we will take steps to delete that information.`,
  },
  {
    title: "12. Security",
    content: `We implement technical and organizational security measures designed to protect your personal data against unauthorized access, alteration, disclosure, or destruction. These include encryption in transit (TLS), access controls, regular security audits, and employee data protection training. However, no method of transmission over the Internet or method of electronic storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: "13. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, regulatory, or operational reasons. We will notify you of material changes by posting the updated policy on our website and updating the "Last Updated" date. Your continued use of the Services after the effective date of the revised policy constitutes your acceptance of the changes.`,
  },
  {
    title: "14. Contact and DPO",
    content: `For privacy-related questions, to exercise your data rights, or to contact our Data Protection Officer, please reach out:\n\nGllarix Privacy Team\nEmail: hello@gllarix.com\nAddress: Prishtinë, Kosovo (XKS)\n\nIf you are in the EEA and believe we have not adequately addressed your concerns, you have the right to lodge a complaint with your local data protection supervisory authority.`,
  },
];

const Privacy = () => {
  return (
    <main className="min-h-screen bg-black">
      <Navigation />

      {/* Hero */}
      <section className="relative pt-40 pb-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Legal
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-400 text-lg">
            Last updated: February 19, 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-24 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Intro */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6">
            <p className="text-gray-400 leading-relaxed text-base">
              At Gllarix, your privacy matters. This Privacy Policy describes how we collect, use, and protect your personal data when you use our AI voice agent and business automation platform. We are GDPR-compliant and committed to transparency about our data practices.
            </p>
          </div>

          {/* GDPR badge */}
          <div className="flex flex-wrap gap-3 mb-6">
            {["GDPR Compliant", "Data Encrypted in Transit", "No Data Selling", "Right to Erasure"].map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {badge}
              </span>
            ))}
          </div>

          {/* Sections */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-10">
            {sections.map((section, i) => (
              <div key={i} id={(section as any).id}>
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-3">
                  {section.title}
                </h2>
                <p className="text-gray-400 leading-relaxed text-sm sm:text-base whitespace-pre-line">
                  {section.content}
                </p>
                {i < sections.length - 1 && (
                  <div className="mt-10 border-t border-white/10" />
                )}
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-6 text-center text-gray-500 text-sm">
            This Privacy Policy is effective as of February 19, 2026. Questions? Email us at{" "}
            <a href="mailto:hello@gllarix.com" className="text-primary hover:underline">
              hello@gllarix.com
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Privacy;
