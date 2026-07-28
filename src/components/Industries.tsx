import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Car,
  CreditCard,
  GraduationCap,
  Heart,
  Home,
  Hotel,
  MessageSquare,
  Phone,
  Shield,
  Sun,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

const industries = [
  {
    id: "real-estate",
    label: "Real estate",
    icon: Home,
    agent: "AI Realtor",
    headline: "Respond to every property inquiry while interest is high.",
    description:
      "Qualify buyers, answer listing questions, arrange tours, and keep prospects moving without adding another coordinator.",
    automations: [
      "Lead qualification",
      "Property tour booking",
      "Listing follow-up",
      "CRM status updates",
    ],
    result: "A qualified viewing appears directly in the assigned agent's calendar.",
    activeClass: "bg-gradient-to-r from-cyan-100 to-white text-black",
    iconClass: "border-cyan-200/25 bg-cyan-300/[0.08] text-cyan-100",
    numberClass: "text-cyan-200/80",
  },
  {
    id: "healthcare",
    label: "Healthcare",
    icon: Heart,
    agent: "AI Receptionist",
    headline: "Make patient access immediate and consistent.",
    description:
      "Answer routine questions, schedule within approved availability, send reminders, and route sensitive cases to staff.",
    automations: [
      "Appointment scheduling",
      "Patient reminders",
      "Intake collection",
      "Staff escalation",
    ],
    result: "The patient receives a confirmed appointment without waiting on hold.",
    activeClass: "bg-gradient-to-r from-rose-100 to-white text-black",
    iconClass: "border-rose-200/25 bg-rose-300/[0.08] text-rose-100",
    numberClass: "text-rose-200/80",
  },
  {
    id: "solar",
    label: "Solar",
    icon: Sun,
    agent: "AI Solar Assistant",
    headline: "Turn fresh solar inquiries into qualified site visits.",
    description:
      "Contact new leads immediately, establish eligibility, answer common questions, and schedule the next sales step.",
    automations: [
      "Lead response",
      "Eligibility questions",
      "Site survey scheduling",
      "Persistent follow-up",
    ],
    result: "Sales receives a qualified homeowner with a scheduled site survey.",
    activeClass: "bg-gradient-to-r from-amber-100 to-white text-black",
    iconClass: "border-amber-200/25 bg-amber-300/[0.08] text-amber-100",
    numberClass: "text-amber-200/80",
  },
  {
    id: "recruiting",
    label: "Recruiting",
    icon: Users,
    agent: "AI Recruiter",
    headline: "Move qualified candidates forward without calendar friction.",
    description:
      "Screen applicants consistently, coordinate interview availability, and keep candidates informed throughout the process.",
    automations: [
      "Candidate screening",
      "Interview scheduling",
      "Status updates",
      "Onboarding reminders",
    ],
    result: "The hiring team receives a screened candidate and a confirmed interview.",
    activeClass: "bg-gradient-to-r from-violet-100 to-white text-black",
    iconClass: "border-violet-200/25 bg-violet-300/[0.08] text-violet-100",
    numberClass: "text-violet-200/80",
  },
  {
    id: "automotive",
    label: "Automotive",
    icon: Car,
    agent: "AI Sales Agent",
    headline: "Keep every vehicle inquiry moving toward the showroom.",
    description:
      "Answer inventory questions, qualify intent, schedule test drives, and reconnect with prospects who have gone quiet.",
    automations: [
      "Inventory inquiries",
      "Test-drive booking",
      "Trade-in intake",
      "Sales follow-up",
    ],
    result: "A prepared buyer arrives for a test drive with the right salesperson assigned.",
    activeClass: "bg-gradient-to-r from-blue-100 to-white text-black",
    iconClass: "border-blue-200/25 bg-blue-300/[0.08] text-blue-100",
    numberClass: "text-blue-200/80",
  },
  {
    id: "finance",
    label: "Financial services",
    icon: CreditCard,
    agent: "AI Loan Assistant",
    headline: "Guide applicants through the next step without delays.",
    description:
      "Collect initial information, request missing documents, schedule advisor calls, and provide approved status updates.",
    automations: [
      "Application intake",
      "Document reminders",
      "Advisor scheduling",
      "Status notifications",
    ],
    result: "The advisor receives a complete initial file before the first conversation.",
    activeClass: "bg-gradient-to-r from-emerald-100 to-white text-black",
    iconClass: "border-emerald-200/25 bg-emerald-300/[0.08] text-emerald-100",
    numberClass: "text-emerald-200/80",
  },
  {
    id: "hospitality",
    label: "Hospitality",
    icon: Hotel,
    agent: "AI Concierge",
    headline: "Give every guest an immediate, on-brand response.",
    description:
      "Handle reservation questions, guest requests, pre-arrival information, and post-stay feedback around the clock.",
    automations: [
      "Reservation assistance",
      "Guest requests",
      "Pre-arrival messages",
      "Feedback collection",
    ],
    result: "The request is resolved or routed with the full conversation attached.",
    activeClass: "bg-gradient-to-r from-teal-100 to-white text-black",
    iconClass: "border-teal-200/25 bg-teal-300/[0.08] text-teal-100",
    numberClass: "text-teal-200/80",
  },
  {
    id: "insurance",
    label: "Insurance",
    icon: Shield,
    agent: "AI Insurance Assistant",
    headline: "Keep policyholders informed without creating service queues.",
    description:
      "Handle routine policy questions, collect claims details, remind customers about renewals, and schedule licensed support.",
    automations: [
      "Renewal outreach",
      "Claims intake",
      "Quote qualification",
      "Advisor booking",
    ],
    result: "The licensed team receives a structured request with the next action already arranged.",
    activeClass: "bg-gradient-to-r from-orange-100 to-white text-black",
    iconClass: "border-orange-200/25 bg-orange-300/[0.08] text-orange-100",
    numberClass: "text-orange-200/80",
  },
  {
    id: "education",
    label: "Education",
    icon: GraduationCap,
    agent: "AI Student Assistant",
    headline: "Give students clear answers at every stage of their journey.",
    description:
      "Support enrollment questions, registration, reminders, and event booking while routing complex cases to the right office.",
    automations: [
      "Enrollment support",
      "Registration reminders",
      "Event scheduling",
      "Department routing",
    ],
    result: "The student gets an answer immediately and staff receives only the cases that need them.",
    activeClass: "bg-gradient-to-r from-indigo-100 to-white text-black",
    iconClass: "border-indigo-200/25 bg-indigo-300/[0.08] text-indigo-100",
    numberClass: "text-indigo-200/80",
  },
];

const capabilities = [
  { icon: Phone, label: "Natural voice" },
  { icon: MessageSquare, label: "Messaging and follow-up" },
  { icon: Calendar, label: "Live scheduling" },
];

const Industries = () => {
  const [activeId, setActiveId] = useState(industries[0].id);
  const activeIndustry =
    industries.find((industry) => industry.id === activeId) ?? industries[0];
  const ActiveIcon = activeIndustry.icon;

  return (
    <section
      id="industries"
      className="relative scroll-mt-20 py-24 sm:scroll-mt-24 sm:py-28 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
      <div className="container mx-auto px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <p className="mb-5 text-[10px] font-light uppercase tracking-[0.3em] text-cyan-200/65 sm:text-xs">
                Built around your workflow
              </p>
              <h2 className="max-w-4xl [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-4xl font-light leading-[0.96] text-white sm:text-5xl md:text-6xl lg:text-7xl">
                One system. Tuned to your industry.
              </h2>
            </div>
            <p className="text-sm font-light leading-relaxed text-white/52 sm:text-base">
              The technology stays consistent. The questions, rules,
              integrations, and outcomes are configured around how your team
              actually works.
            </p>
          </header>

          <div className="mt-12 grid border-y border-white/12 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <div
              className="industry-tab-scroll flex gap-2 overflow-x-auto border-b border-white/12 py-3 lg:block lg:border-b-0 lg:border-r lg:border-white/12 lg:py-5"
              role="tablist"
              aria-label="Industry solutions"
            >
              {industries.map((industry) => {
                const Icon = industry.icon;
                const isActive = industry.id === activeIndustry.id;

                return (
                  <button
                    key={industry.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveId(industry.id)}
                    className={`flex shrink-0 items-center gap-3 px-4 py-3 text-left text-xs font-light outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/60 lg:w-full ${
                      isActive
                        ? industry.activeClass
                        : "text-white/45 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{industry.label}</span>
                    <ArrowRight
                      className={`hidden h-3.5 w-3.5 lg:block ${
                        isActive ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="min-w-0 px-5 py-9 sm:px-8 lg:px-10 lg:py-11">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center border ${activeIndustry.iconClass}`}
                >
                  <ActiveIcon className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-light uppercase tracking-[0.2em] text-white/42">
                  {activeIndustry.agent}
                </span>
              </div>

              <h3 className="mt-7 max-w-4xl text-3xl font-light leading-tight text-white sm:text-4xl lg:text-[2.75rem]">
                {activeIndustry.headline}
              </h3>
              <p className="mt-4 max-w-3xl text-sm font-light leading-relaxed text-white/50 sm:text-base">
                {activeIndustry.description}
              </p>

              <div className="mt-10 grid border-t border-white/12 lg:grid-cols-[0.72fr_1.25fr_0.9fr]">
                <div className="py-7 lg:pr-8">
                  <p className="text-[9px] uppercase tracking-[0.22em] text-white/32">
                    Incoming
                  </p>
                  <p className="mt-4 text-lg font-light leading-snug text-white/72">
                    A new {activeIndustry.label.toLowerCase()} request arrives.
                  </p>
                </div>

                <div className="border-t border-white/10 py-7 lg:border-l lg:border-t-0 lg:border-white/10 lg:px-8">
                  <p className="text-[9px] uppercase tracking-[0.22em] text-white/32">
                    Agent work
                  </p>
                  <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {activeIndustry.automations.map((automation, index) => (
                      <div
                        key={automation}
                        className="flex items-center gap-3 text-sm font-light text-white/72"
                      >
                        <span className={`text-[9px] ${activeIndustry.numberClass}`}>
                          0{index + 1}
                        </span>
                        {automation}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-white/10 py-7 lg:border-l lg:border-t-0 lg:border-white/10 lg:pl-8">
                  <p className="text-[9px] uppercase tracking-[0.22em] text-white/32">
                    Result
                  </p>
                  <p className="mt-4 text-lg font-light leading-snug text-white">
                    {activeIndustry.result}
                  </p>
                </div>
              </div>

              <Link
                to="/book-meeting"
                className={`mt-3 inline-flex items-center gap-2 text-xs font-light uppercase tracking-[0.16em] transition-opacity hover:opacity-65 ${activeIndustry.numberClass}`}
              >
                Discuss this workflow
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-4">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">
              Included in every setup
            </span>
            {capabilities.map((capability) => {
              const Icon = capability.icon;

              return (
                <span
                  key={capability.label}
                  className="flex items-center gap-2 text-xs font-light text-white/55"
                >
                  <Icon className="h-4 w-4" />
                  {capability.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Industries;
