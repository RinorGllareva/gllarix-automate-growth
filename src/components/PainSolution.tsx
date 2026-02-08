import React, { useState, useMemo } from "react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import ConversionsCard from "@/components/comparison/ConversionsCard";
import ExpensesCard from "@/components/comparison/ExpensesCard";
import CapacityCard from "@/components/comparison/CapacityCard";

const PainSolution = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const { ref: cardsRef, isVisible: cardsVisible } = useScrollAnimation(0.1);
  const { ref: calcRef, isVisible: calcVisible } = useScrollAnimation(0.1);
  const { ref: compareRef, isVisible: compareVisible } = useScrollAnimation(0.1);
  const { ref: ctaRef, isVisible: ctaVisible } = useScrollAnimation(0.2);

  const [monthlyLeads, setMonthlyLeads] = useState(1000);
  const [humanSetters, setHumanSetters] = useState(1);
  const [avgDealValue, setAvgDealValue] = useState(5000);

  const results = useMemo(() => {
    const humanConversion = 0.15;
    const aiConversion = 0.40;
    const humanCostPerSetter = 2000;
    const aiCost = 297;

    const humanAppointments = Math.round(monthlyLeads * humanConversion);
    const aiAppointments = Math.round(monthlyLeads * aiConversion);
    const extraAppointments = aiAppointments - humanAppointments;

    const humanMonthlyCost = humanSetters * humanCostPerSetter;
    const monthlySavings = humanMonthlyCost - aiCost;
    const annualSavings = monthlySavings * 12;

    const additionalRevenue = extraAppointments * avgDealValue;

    return { annualSavings, extraAppointments, additionalRevenue };
  }, [monthlyLeads, humanSetters, avgDealValue]);

  return (
    <section className="relative py-32 bg-gradient-to-b from-gray-900 via-black to-gray-900 overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px), linear-gradient(hsl(var(--primary)) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div
            ref={headerRef}
            className={`text-center mb-20 transition-all duration-1000 ${
              headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
              <span className="text-primary text-sm font-medium">Why AI Agents?</span>
            </div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4 text-white">
              Outperforms Traditional Teams.
            </h2>
            <p className="text-xl text-gray-400">We will:</p>
          </div>

          {/* Three Comparison Cards */}
          <div
            ref={cardsRef}
            className={`grid md:grid-cols-3 gap-6 mb-24 transition-all duration-1000 ${
              cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <ConversionsCard />
            <ExpensesCard />
            <CapacityCard />
          </div>

          {/* ROI Calculator */}
          <div
            ref={calcRef}
            className={`mb-24 transition-all duration-1000 ${
              calcVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            {/* Inputs */}
            <div className="grid md:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Monthly Leads</label>
                <input
                  type="number"
                  value={monthlyLeads}
                  onChange={(e) => setMonthlyLeads(Number(e.target.value) || 0)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Current Human Setters</label>
                <input
                  type="number"
                  value={humanSetters}
                  onChange={(e) => setHumanSetters(Number(e.target.value) || 0)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Average Deal Value</label>
                <input
                  type="number"
                  value={avgDealValue}
                  onChange={(e) => setAvgDealValue(Number(e.target.value) || 0)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Results */}
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-sm text-gray-400 mb-2">Annual Savings</div>
                <div className="text-3xl md:text-4xl font-bold text-green-400">
                  ${results.annualSavings.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">saved per year</div>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-sm text-gray-400 mb-2">Extra Appointments/Month</div>
                <div className="text-3xl md:text-4xl font-bold text-green-400">
                  +{results.extraAppointments.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">more bookings</div>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
                <div className="text-sm text-gray-400 mb-2">Additional Revenue/Month</div>
                <div className="text-3xl md:text-4xl font-bold text-green-400">
                  ${results.additionalRevenue.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">extra revenue</div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Comparison */}
          <div
            ref={compareRef}
            className={`grid md:grid-cols-2 gap-6 mb-20 max-w-4xl mx-auto transition-all duration-1000 ${
              compareVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            {/* Traditional Team */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
              <h4 className="text-lg font-bold text-white mb-4">Human Setters</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-400">Conversion Rate</span>
                    <span className="text-red-400 font-semibold">15%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500/60 rounded-full" style={{ width: '15%' }} />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Monthly Cost</span>
                  <span className="text-red-400 font-semibold">$2,000</span>
                </div>
              </div>
            </div>

            {/* Gllarix AI */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
              <h4 className="text-lg font-bold text-white mb-4">Gllarix AI</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-400">Conversion Rate</span>
                    <span className="text-green-400 font-semibold">40%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500/60 rounded-full" style={{ width: '40%' }} />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Monthly Cost</span>
                  <span className="text-green-400 font-semibold">$297</span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div
            ref={ctaRef}
            className={`text-center transition-all duration-1000 ${
              ctaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <p className="text-xl text-gray-400 mb-6">
              Ready to Save <span className="text-green-400 font-bold">${results.annualSavings.toLocaleString()}/year</span>?
            </p>
            <p className="text-gray-500 text-sm mb-8 max-w-lg mx-auto">
              Start your 14-day free trial and see the results for yourself
            </p>
            <Button
              asChild
              className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-xl font-semibold transition-all hover:scale-105"
            >
              <Link to="/book-meeting">
                Build My FREE AI Agent
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainSolution;
