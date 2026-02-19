import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: `By accessing or using the Gllarix platform, website, or any of our services (collectively, the "Services"), you confirm that you are at least 18 years of age, have read and understood these Terms, and agree to be bound by them. If you are using the Services on behalf of a company or other legal entity, you represent that you have the authority to bind that entity to these Terms.`,
  },
  {
    title: "2. Description of Services",
    content: `Gllarix provides AI-powered voice agents and business automation solutions, including but not limited to: automated inbound and outbound call handling, appointment scheduling and booking management, CRM integration and data synchronization, lead qualification and follow-up automation, and custom workflow automations. Our Services are designed to integrate with your existing business infrastructure to reduce manual workload and improve operational efficiency.`,
  },
  {
    title: "3. User Accounts and Responsibilities",
    content: `You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account. You must provide accurate, current, and complete information during registration and keep your account information updated. Gllarix reserves the right to suspend or terminate accounts that contain false or misleading information.`,
  },
  {
    title: "4. Acceptable Use Policy",
    content: `You agree not to use the Services for any unlawful purpose or in any way that violates these Terms. Prohibited activities include: using the Services to transmit spam, harass, or deceive end users; attempting to gain unauthorized access to our systems; reselling or sublicensing the Services without express written consent; using the Services in any way that could damage, disable, or impair our infrastructure; and collecting or harvesting any personally identifiable information from the Services.`,
  },
  {
    title: "5. Payment and Billing",
    content: `Subscriptions are billed in advance on a monthly or annual basis depending on the plan selected. All fees are non-refundable except as expressly stated in these Terms or required by applicable law. We reserve the right to change our pricing at any time with 30 days' notice. Failure to pay may result in suspension or termination of your account. All prices are listed in USD unless otherwise stated.`,
  },
  {
    title: "6. Intellectual Property",
    content: `All content, technology, software, and materials comprising the Gllarix platform are the exclusive property of Gllarix and its licensors, protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the Services solely for your internal business purposes during the subscription term. You retain ownership of all data you input into the Services; Gllarix does not claim ownership of your business data.`,
  },
  {
    title: "7. Data and Privacy",
    content: `Your use of the Services is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Services, you consent to the collection, processing, and use of your data as described in the Privacy Policy. We implement industry-standard security measures to protect your data, but no system is completely secure, and we cannot guarantee absolute security.`,
  },
  {
    title: "8. Limitation of Liability",
    content: `To the maximum extent permitted by applicable law, Gllarix and its officers, employees, agents, and licensors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, goodwill, or business interruption, arising from your use of or inability to use the Services. Our total aggregate liability to you for any claims arising out of or relating to these Terms or the Services shall not exceed the amount you paid to us in the 12 months preceding the claim.`,
  },
  {
    title: "9. Indemnification",
    content: `You agree to indemnify, defend, and hold harmless Gllarix and its officers, directors, employees, and agents from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the Services, including any data you submit, transmit, or display through the Services.`,
  },
  {
    title: "10. Termination",
    content: `Either party may terminate the Services at any time. You may cancel your subscription through your account settings or by contacting us at hello@gllarix.com. We may suspend or terminate your access immediately, without prior notice, if we reasonably believe you have violated these Terms. Upon termination, your right to use the Services will immediately cease. We may retain your data for up to 90 days following termination before permanent deletion, unless otherwise required by law.`,
  },
  {
    title: "11. Governing Law and Jurisdiction",
    content: `These Terms shall be governed by and construed in accordance with the laws of the Republic of Kosovo, without regard to its conflict of law provisions. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Prishtinë, Kosovo. If you are a consumer in the European Union, you may also have rights under the mandatory consumer protection laws of your country of residence.`,
  },
  {
    title: "12. Changes to Terms",
    content: `We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on our website and updating the "Last Updated" date at the top of this page. Your continued use of the Services after the effective date of the revised Terms constitutes your acceptance of the changes. If you do not agree to the revised Terms, you must stop using the Services.`,
  },
  {
    title: "13. Contact Information",
    content: `If you have any questions or concerns about these Terms of Service, please contact us at:\n\nGllarix\nPrishtinë, Kosovo (XKS)\nEmail: hello@gllarix.com\n\nWe aim to respond to all inquiries within 2 business days.`,
  },
];

const Terms = () => {
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
            Terms of Service
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
              Welcome to Gllarix. These Terms of Service ("Terms") govern your access to and use of our AI voice agent and business automation platform. Please read these Terms carefully before using our Services. By accessing or using Gllarix, you agree to be bound by these Terms.
            </p>
          </div>

          {/* Sections */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-10">
            {sections.map((section, i) => (
              <div key={i}>
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
            These Terms of Service are effective as of February 19, 2026. By continuing to use Gllarix, you acknowledge that you have read, understood, and agreed to these Terms.
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Terms;
