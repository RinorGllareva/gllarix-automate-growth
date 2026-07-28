import LegalPage from "@/components/LegalPage";

const Terms = () => {
  return (
    <LegalPage
      accent="cobalt"
      eyebrow="Legal"
      title="Terms of service"
      summary="The basic rules for using Gllarix websites, AI agents, integrations, and related professional services."
      updated="July 28, 2026"
      sections={[
        {
          title: "Using Gllarix",
          content: (
            <p>
              You must use the services lawfully and provide accurate account,
              configuration, and business information. You are responsible for
              authorized users and for obtaining any notices or consents
              required for calls, messages, recordings, and customer data.
            </p>
          ),
        },
        {
          title: "Scope and payment",
          content: (
            <p>
              Features, implementation work, fees, usage limits, and payment
              terms are defined in the proposal or order you accept. Work
              outside that scope may require a separate written agreement.
            </p>
          ),
        },
        {
          title: "Customer data",
          content: (
            <p>
              You retain ownership of data you provide. You grant Gllarix the
              limited right to process it only as needed to provide, secure,
              support, and improve the contracted service.
            </p>
          ),
        },
        {
          title: "AI and automation",
          content: (
            <p>
              Automated outputs may require human review, particularly for
              regulated, financial, medical, legal, or high-impact decisions.
              You remain responsible for the business rules you approve and
              for decisions made using service outputs.
            </p>
          ),
        },
        {
          title: "Availability and liability",
          content: (
            <p>
              We work to keep the service reliable, but availability may be
              affected by maintenance, third-party systems, or events outside
              our control. Liability and warranty terms may be further defined
              in your signed agreement and are limited to the extent permitted
              by applicable law.
            </p>
          ),
        },
        {
          title: "Changes and contact",
          content: (
            <p>
              We may update these terms when services or legal requirements
              change. Material updates will be posted with a revised date.
              Questions may be sent to hello@gllarix.com.
            </p>
          ),
        },
      ]}
    />
  );
};

export default Terms;
