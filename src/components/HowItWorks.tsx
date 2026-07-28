import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Plug,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  {
    number: "01",
    shortTitle: "Connect",
    title: "Connect the tools you already use.",
    description:
      "We securely connect your phone, calendar, CRM, and lead sources. Your existing workflow stays in place.",
    icon: Plug,
    features: [
      "Keep your current phone number",
      "Read live calendar availability",
      "Write every outcome back to your CRM",
    ],
    flow: ["Customer calls", "Gllarix receives context", "Systems connected"],
    outcome: "Ready for configuration",
  },
  {
    number: "02",
    shortTitle: "Define",
    title: "Define exactly how the agent should work.",
    description:
      "Set the voice, qualification questions, routing rules, availability, and escalation points with your team.",
    icon: SlidersHorizontal,
    features: [
      "Use your scripts and business rules",
      "Choose what qualifies a lead",
      "Control booking and human handoff",
    ],
    flow: ["Your playbook", "Rules configured", "Test conversations"],
    outcome: "Approved and ready",
  },
  {
    number: "03",
    shortTitle: "Go live",
    title: "Go live, then improve from real outcomes.",
    description:
      "The agent answers, qualifies, books, follows up, and syncs every result. You can review performance in real time.",
    icon: Radio,
    features: [
      "Handle calls and messages continuously",
      "Book directly into available slots",
      "Track outcomes and refine the workflow",
    ],
    flow: ["Lead reaches out", "Agent completes the task", "CRM updated"],
    outcome: "Operating 24/7",
  },
];

const HowItWorks = () => {
  const [activeStep, setActiveStep] = useState(0);
  const step = steps[activeStep];
  const StepIcon = step.icon;

  return (
    <section
      id="how-it-works"
      className="relative border-y border-white/[0.08] py-24 sm:py-28 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/35 to-cyan-300/25" />
      <div className="container mx-auto px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <p className="mb-5 text-[10px] font-light uppercase tracking-[0.3em] text-violet-200/65 sm:text-xs">
                Three steps. One working agent.
              </p>
              <h2 className="max-w-4xl [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-4xl font-light leading-[0.96] text-white sm:text-5xl md:text-6xl lg:text-7xl">
                From your tools to live automation.
              </h2>
            </div>
            <p className="text-sm font-light leading-relaxed text-white/52 sm:text-base">
              No platform migration and no technical project for your team.
              Connect, define, and launch.
            </p>
          </header>

          <div
            className="mt-12 grid border-y border-white/12 md:grid-cols-3"
            role="tablist"
            aria-label="Gllarix setup process"
          >
            {steps.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === activeStep;

              return (
                <button
                  key={item.number}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="process-step-panel"
                  onClick={() => setActiveStep(index)}
                  className={`flex min-h-20 items-center gap-4 border-b border-white/10 px-5 text-left transition-colors last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 ${
                    isActive
                      ? "bg-gradient-to-r from-violet-100 to-cyan-100 text-black"
                      : "bg-black/15 text-white/48 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="text-[10px] font-medium tracking-[0.18em]">
                    {item.number}
                  </span>
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.shortTitle}</span>
                </button>
              );
            })}
          </div>

          <div
            id="process-step-panel"
            role="tabpanel"
            className="grid gap-12 border-b border-white/12 py-12 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-20 lg:py-16"
          >
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-violet-200/25 bg-violet-300/[0.08]">
                <StepIcon className="h-5 w-5 text-violet-100" />
              </div>
              <p className="mt-8 text-[10px] uppercase tracking-[0.24em] text-white/38">
                Step {step.number}
              </p>
              <h3 className="mt-3 max-w-3xl text-3xl font-light leading-tight text-white sm:text-4xl lg:text-5xl">
                {step.title}
              </h3>
              <p className="mt-5 max-w-2xl text-sm font-light leading-relaxed text-white/52 sm:text-base">
                {step.description}
              </p>

              <ul className="mt-8 grid gap-3 sm:grid-cols-3">
                {step.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 border-t border-white/10 pt-3 text-xs font-light leading-relaxed text-white/64 sm:text-sm"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="self-end border-l border-white/15 pl-6">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                What happens
              </p>
              <div className="mt-6 space-y-0">
                {step.flow.map((item, index) => (
                  <div key={item}>
                    <div className="flex items-center gap-4 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/18 text-[10px] text-white/60">
                        {index + 1}
                      </span>
                      <span className="text-sm font-light text-white/72">
                        {item}
                      </span>
                    </div>
                    {index < step.flow.length - 1 ? (
                      <div className="ml-3.5 h-5 w-px bg-white/15" />
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-5">
                <CalendarCheck className="h-4 w-4 text-violet-200" />
                <span className="text-xs uppercase tracking-[0.15em] text-white/55">
                  {step.outcome}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-light text-white/42">
              Most teams can review a working first version within days.
            </p>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 text-xs font-light uppercase tracking-[0.16em] text-violet-100 transition-colors hover:text-cyan-200"
            >
              See the process live
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
