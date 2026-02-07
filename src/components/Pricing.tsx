import React from "react";
import { ArrowRight, Brain, Users, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Link } from "react-router-dom";

const Pricing = () => {
  const { ref: factorsRef, isVisible: factorsVisible } = useScrollAnimation(0.15);

  const pricingFactors = [
    {
      icon: Brain,
      title: "AI Complexity",
      description: "Simple workflows to multi-agent systems",
    },
    {
      icon: Users,
      title: "Interaction Volume",
      description: "Based on your actual usage",
    },
    {
      icon: TrendingUp,
      title: "Integration Depth",
      description: "How deeply we connect to your systems",
    },
    {
      icon: Clock,
      title: "Support Level",
      description: "Standard to dedicated management",
    },
  ];

  return (
    <section className="relative py-16 sm:py-20 bg-black overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px), linear-gradient(hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Factors */}
          <div
            ref={factorsRef}
            className={`transition-all duration-1000 ${
              factorsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="text-center mb-10">
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                What Influences Your Price?
              </h3>
              <p className="text-gray-500 text-sm">
                Each solution is custom-built for your business
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {pricingFactors.map((factor, index) => {
                const Icon = factor.icon;
                return (
                  <div
                    key={index}
                    className="bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:border-primary/30 transition-all duration-300"
                  >
                    <Icon className="h-5 w-5 text-primary mb-3" />
                    <h4 className="text-sm font-semibold text-white mb-1">
                      {factor.title}
                    </h4>
                    <p className="text-gray-500 text-xs leading-relaxed">
                      {factor.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div className="flex justify-center">
              <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-2xl p-6 sm:p-8 max-w-2xl w-full text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Let's Build Your Perfect Solution
                </h3>
                <p className="text-gray-400 mb-5 text-sm">
                  Book a free consultation to get a custom quote.
                </p>
                <Button
                  asChild
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-4 text-sm rounded-xl font-semibold transition-all hover:scale-105"
                >
                  <Link to="/book-meeting">
                    Start Your Free Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
