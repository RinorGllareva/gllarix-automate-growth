import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import ConversionsCard from "@/components/comparison/ConversionsCard";
import ExpensesCard from "@/components/comparison/ExpensesCard";
import CapacityCard from "@/components/comparison/CapacityCard";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const PainSolution = () => {
  const [monthlyLeads, setMonthlyLeads] = useState(1000);
  const [humanSetters, setHumanSetters] = useState(1);
  const [avgDealValue, setAvgDealValue] = useState(5000);

  const results = useMemo(() => {
    const extraAppointments = Math.round(monthlyLeads * (0.4 - 0.15));
    const annualSavings = Math.max(0, humanSetters * 2000 - 65) * 12;
    const additionalRevenue = extraAppointments * avgDealValue;

    return { annualSavings, extraAppointments, additionalRevenue };
  }, [avgDealValue, humanSetters, monthlyLeads]);

  return (
    <section
      id="services"
      className="relative scroll-mt-20 py-24 sm:scroll-mt-24 sm:py-28 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent" />
      <div className="container mx-auto px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="grid gap-8 border-b border-white/12 pb-12 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end">
            <div>
              <p className="mb-5 text-[10px] font-light uppercase tracking-[0.3em] text-emerald-200/65 sm:text-xs">
                Performance comparison
              </p>
              <h2 className="max-w-4xl [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-4xl font-light leading-[0.96] text-white sm:text-5xl md:text-6xl lg:text-7xl">
                Outperforms traditional teams.
              </h2>
            </div>
            <p className="max-w-md text-sm font-light leading-relaxed text-white/55 sm:text-base">
              Gllarix answers every lead, follows your rules, books directly
              into your calendar, and records each result in the systems you
              already use.
            </p>
          </header>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            <ConversionsCard />
            <ExpensesCard />
            <CapacityCard />
          </div>

          <div className="mt-20 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-16">
            <div>
              <p className="mb-4 text-[10px] font-light uppercase tracking-[0.28em] text-cyan-200/65">
                Your impact model
              </p>
              <h3 className="text-3xl font-light leading-tight text-white sm:text-4xl">
                Adjust the inputs.
                <br />
                See the difference.
              </h3>
              <p className="mt-5 text-sm font-light leading-relaxed text-white/48">
                A simple estimate using the same conversion benchmarks shown
                above.
              </p>
            </div>

            <div>
              <div className="grid gap-8 md:grid-cols-3">
                <label className="block">
                  <span className="flex items-center justify-between text-xs text-white/55">
                    Monthly leads
                    <strong className="font-normal text-white">
                      {monthlyLeads.toLocaleString()}
                    </strong>
                  </span>
                  <input
                    type="range"
                    min="200"
                    max="5000"
                    step="100"
                    value={monthlyLeads}
                    onChange={(event) =>
                      setMonthlyLeads(Number(event.target.value))
                    }
                    className="impact-range impact-range--emerald mt-4 w-full"
                  />
                </label>

                <label className="block">
                  <span className="flex items-center justify-between text-xs text-white/55">
                    Human setters
                    <strong className="font-normal text-white">
                      {humanSetters}
                    </strong>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={humanSetters}
                    onChange={(event) =>
                      setHumanSetters(Number(event.target.value))
                    }
                    className="impact-range impact-range--cyan mt-4 w-full"
                  />
                </label>

                <label className="block">
                  <span className="flex items-center justify-between text-xs text-white/55">
                    Average deal
                    <strong className="font-normal text-white">
                      {formatCurrency(avgDealValue)}
                    </strong>
                  </span>
                  <input
                    type="range"
                    min="500"
                    max="25000"
                    step="500"
                    value={avgDealValue}
                    onChange={(event) =>
                      setAvgDealValue(Number(event.target.value))
                    }
                    className="impact-range impact-range--violet mt-4 w-full"
                  />
                </label>
              </div>

              <div className="mt-10 grid border-y border-white/12 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
                <div className="py-6 sm:px-6 sm:first:pl-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                    Annual savings
                  </p>
                  <p className="mt-2 text-2xl font-light text-emerald-200 sm:text-3xl">
                    {formatCurrency(results.annualSavings)}
                  </p>
                </div>
                <div className="border-t border-white/10 py-6 sm:border-t-0 sm:px-6">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                    Extra bookings / month
                  </p>
                  <p className="mt-2 text-2xl font-light text-cyan-200 sm:text-3xl">
                    +{results.extraAppointments.toLocaleString()}
                  </p>
                </div>
                <div className="border-t border-white/10 py-6 sm:border-t-0 sm:px-6">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                    Revenue opportunity
                  </p>
                  <p className="mt-2 text-2xl font-light text-violet-200 sm:text-3xl">
                    {formatCurrency(results.additionalRevenue)}
                  </p>
                </div>
              </div>

              <Link
                to="/book-meeting"
                className="mt-7 inline-flex items-center gap-2 text-xs font-light uppercase tracking-[0.16em] text-cyan-100 transition-colors hover:text-violet-200"
              >
                Model your workflow
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainSolution;
