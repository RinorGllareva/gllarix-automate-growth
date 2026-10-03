import type { Brand } from "@/data/leadTypes";

/**
 * Contract templates, filled from the deal and its latest quote. DRAFT wording: a lawyer reviews it before the
 * first real signature (same rule as the call scripts: nobody signs unapproved terms by accident, so the page says so).
 * {{placeholders}} are filled by services/contracts.fillContract.
 */
export interface ContractTemplate {
  key: string;
  brand: Brand;
  title: string;
  draft: boolean;
  sections: { heading: string; body: string }[];
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    key: "gllarix_service",
    brand: "gllarix",
    title: "Gllarix service agreement",
    draft: true,
    sections: [
      { heading: "1. Parties", body: "This agreement is between {{provider}} (\"we\") and {{client}}, {{clientPlace}} (\"you\"), signed for you by {{signer}}." },
      { heading: "2. What we deliver", body: "{{items}}\nWe set it up, test it with you and take it live. Changes after go-live are handled as support requests under the service levels in section 5." },
      { heading: "3. Price", body: "Setup: {{setup}}, of which {{deposit}} is paid as a deposit before work starts and the rest at go-live.\nMonthly: {{monthly}}, billed monthly from go-live.{{pilotTerms}}\nUsage above the included minutes is billed at the rates in the quote." },
      { heading: "4. Term and cancelling", body: "The service runs month to month from go-live. Either side can cancel with 30 days' written notice. On cancelling, we release or transfer the phone number and send you an export of your call data." },
      { heading: "5. Service levels", body: "Receptionist down: first reply within 1 hour in your business hours, fixed within 4 hours.\nWrong answers or bookings: first reply the same business day, fixed within 2 business days.\nChange requests: first reply within 1 business day, delivered in the next weekend release." },
      { heading: "6. Data and recordings", body: "Calls may be recorded to run and improve the service. We process personal data only on your instructions and only to deliver the service, keep it in the EU or US data centres of our providers, and delete it on request or when the agreement ends." },
      { heading: "7. Liability", body: "Our total liability in any 12 months is limited to the fees you paid in those 12 months. Neither side is liable for indirect or lost-profit damages." },
      { heading: "8. Governing law", body: "{{law}}" },
    ],
  },
  {
    key: "arcadian_project",
    brand: "arcadian",
    title: "Arcadian project agreement",
    draft: true,
    sections: [
      { heading: "1. Parties", body: "This agreement is between {{provider}} (\"we\") and {{client}}, {{clientPlace}} (\"you\"), signed for you by {{signer}}." },
      { heading: "2. Scope", body: "{{items}}\nThe scope is fixed by this list. Anything else is quoted separately before we start it." },
      { heading: "3. Price and payment", body: "Project fee: {{setup}}. A deposit of {{deposit}} is paid before work starts; the rest is due on delivery.\nOngoing: {{monthly}} per month for hosting, updates and support, from launch.{{pilotTerms}}" },
      { heading: "4. Delivery and approval", body: "We share work in progress for your feedback. Each delivery includes two rounds of changes. You approve the final delivery in writing; silence for 10 business days counts as approval." },
      { heading: "5. Ownership", body: "Once paid in full, you own the final renders, models and content made for you. We keep the right to show the work in our portfolio unless you ask us not to." },
      { heading: "6. Liability", body: "Our total liability is limited to the fees paid under this agreement. Neither side is liable for indirect or lost-profit damages." },
      { heading: "7. Governing law", body: "{{law}}" },
    ],
  },
];

/** Legal names and addresses aren't settled yet: the placeholders show in every draft until they are. */
export const PROVIDER: Record<Brand, string> = {
  gllarix: "Gllarix [legal entity and address to confirm]",
  arcadian: "Arcadian Labs [legal entity and address to confirm]",
};

/** Governing law per client country, to confirm with counsel. */
export const GOVERNING_LAW = (country: string | null) =>
  `This agreement is governed by the law of [to confirm with our lawyer for ${country ?? "this client's country"}]. Disputes go first to a good-faith call between the founders and you.`;

export const templateFor = (brand: Brand) => CONTRACT_TEMPLATES.find((t) => t.brand === brand) ?? CONTRACT_TEMPLATES[0];
