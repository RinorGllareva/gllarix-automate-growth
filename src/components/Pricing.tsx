import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";

const pricingFactors = [
  {
    title: "Workflow complexity",
    summary: "How many decisions the agent needs to make.",
    detail:
      "A focused booking agent is simpler than a multi-department system with qualification, routing, escalation, and follow-up rules.",
    includes: ["Conversation paths", "Business rules", "Escalation logic"],
    range: "Focused to multi-agent",
  },
  {
    title: "Interaction volume",
    summary: "The number and length of conversations.",
    detail:
      "We scope for realistic peak demand, not only your monthly average, so the system remains responsive when campaigns or seasonal volume increases.",
    includes: ["Monthly conversations", "Peak concurrency", "Average duration"],
    range: "Hundreds to thousands",
  },
  {
    title: "Integration depth",
    summary: "Where information needs to move.",
    detail:
      "Pricing reflects whether Gllarix simply books a calendar or reads, writes, and coordinates data across your CRM, phone system, and internal tools.",
    includes: ["CRM and calendar", "Phone and messaging", "Custom system actions"],
    range: "One tool to full workflow",
  },
  {
    title: "Service level",
    summary: "How much ongoing management your team wants.",
    detail:
      "Choose a self-managed setup with standard support or a managed partnership with continuous optimization, reporting, and dedicated oversight.",
    includes: ["Launch support", "Optimization cadence", "Dedicated management"],
    range: "Standard to managed",
  },
];

const Pricing = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFactor = pricingFactors[activeIndex];

  return (
    <section
      id="pricing"
      className="relative scroll-mt-20 py-24 sm:scroll-mt-24 sm:py-28 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-violet-300/20" />
      <div className="container mx-auto px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="grid gap-8 border-b border-white/12 pb-12 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end">
            <div>
              <p className="mb-5 text-[10px] font-light uppercase tracking-[0.3em] text-amber-200/70 sm:text-xs">
                Transparent scoping
              </p>
              <h2 className="max-w-4xl [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-4xl font-light leading-[0.96] text-white sm:text-5xl md:text-6xl lg:text-7xl">
                What influences your price?
              </h2>
            </div>
            <p className="max-w-md text-sm font-light leading-relaxed text-white/52 sm:text-base">
              You pay for the workflow Gllarix runs, not an arbitrary software
              tier. Four practical inputs determine the scope.
            </p>
          </header>

          <div className="grid border-b border-white/12 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.45fr)]">
            <div
              className="border-b border-white/12 py-5 lg:border-b-0 lg:border-r lg:border-white/12"
              role="tablist"
              aria-label="Pricing factors"
            >
              {pricingFactors.map((factor, index) => {
                const isActive = index === activeIndex;

                return (
                  <button
                    key={factor.title}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveIndex(index)}
                    className={`group flex w-full items-center gap-4 px-4 py-5 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/60 sm:px-6 ${
                      isActive
                        ? "bg-gradient-to-r from-amber-100 to-white text-black"
                        : "text-white/48 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    <span className="text-[10px] font-light">0{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-light">
                        {factor.title}
                      </span>
                      <span
                        className={`mt-1 block text-xs font-light ${
                          isActive ? "text-black/55" : "text-white/32"
                        }`}
                      >
                        {factor.summary}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </button>
                );
              })}
            </div>

            <div className="px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.22em] text-white/35">
                    Selected factor
                  </p>
                  <h3 className="mt-4 text-3xl font-light text-white sm:text-4xl">
                    {activeFactor.title}
                  </h3>
                </div>
                <span className="border border-amber-200/20 bg-amber-300/[0.05] px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-amber-100/70">
                  {activeFactor.range}
                </span>
              </div>

              <p className="mt-7 max-w-3xl text-base font-light leading-relaxed text-white/58 sm:text-lg">
                {activeFactor.detail}
              </p>

              <div className="mt-10 grid gap-4 border-y border-white/12 py-6 sm:grid-cols-3">
                {activeFactor.includes.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm font-light text-white/68"
                  >
                    <Check className="h-4 w-4 text-amber-200/85" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-lg text-xs font-light leading-relaxed text-white/38">
                  A short discovery call is enough to map these inputs and
                  produce a clear implementation scope.
                </p>
                <Link
                  to="/book-meeting"
                  className="inline-flex shrink-0 items-center justify-center gap-3 border border-amber-100/35 bg-gradient-to-r from-amber-100 via-white to-violet-100 px-5 py-3 text-xs font-light uppercase tracking-[0.14em] text-black transition-[filter] hover:brightness-110"
                >
                  Get a custom scope
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
