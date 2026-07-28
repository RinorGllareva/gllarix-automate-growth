import LegalPage from "@/components/LegalPage";

const Privacy = () => {
  return (
    <LegalPage
      accent="pearl"
      eyebrow="Legal"
      title="Privacy policy"
      summary="A clear overview of what information Gllarix receives, why it is used, and the choices available to you."
      updated="July 28, 2026"
      sections={[
        {
          title: "Information we receive",
          content: (
            <p>
              We receive information you submit through forms, meetings, or
              direct communication, such as your name, work email, company, and
              project details. Our website may also collect basic device,
              browser, and usage information needed for security and operation.
            </p>
          ),
        },
        {
          title: "How we use it",
          content: (
            <p>
              We use information to respond to requests, provide and improve
              Gllarix services, operate integrations, prevent misuse, and meet
              legal obligations. We do not sell personal information.
            </p>
          ),
        },
        {
          title: "Service providers",
          content: (
            <p>
              We may use trusted infrastructure, communications, analytics, and
              scheduling providers. They receive only the information required
              to perform their service and must protect it under contractual
              obligations.
            </p>
          ),
        },
        {
          title: "Retention and security",
          content: (
            <p>
              Information is retained only as long as needed for the purpose it
              was collected, contractual requirements, or law. We use
              reasonable technical and organizational safeguards, but no
              internet service can guarantee absolute security.
            </p>
          ),
        },
        {
          title: "Your choices",
          content: (
            <p>
              Depending on your location, you may request access, correction,
              deletion, restriction, or a copy of your personal information.
              You may also object to certain processing or withdraw consent
              where consent is the legal basis.
            </p>
          ),
        },
        {
          title: "Contact",
          content: (
            <p>
              Send privacy questions or requests to hello@gllarix.com. We may
              ask for reasonable verification before completing a request.
            </p>
          ),
        },
      ]}
    />
  );
};

export default Privacy;
