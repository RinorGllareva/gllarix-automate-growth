import React from "react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Link2, Bot, Zap, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Floating3DOrb } from "./Floating3DOrb";
import { Link } from "react-router-dom";

const HowItWorks = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const { ref: ctaRef, isVisible: ctaVisible } = useScrollAnimation(0.2);

  const steps = [
    {
      step: "01",
      icon: Link2,
      title: "Connect Your Systems",
      description: "Link Gllarix to your CRM, calendar, or lead sources in minutes. No technical expertise required.",
      features: [
        "One-click CRM integration",
        "Automatic calendar sync",
        "Connect lead sources instantly",
        "Custom workflow builder"
      ]
    },
    {
      step: "02",
      icon: Bot,
      title: "AI Agents Go to Work",
      description: "Our AI agents start handling calls, bookings, reminders, and follow-ups using your business rules.",
      features: [
        "Natural voice conversations",
        "Intelligent appointment booking",
        "Smart lead qualification",
        "Automated customer follow-ups"
      ]
    },
    {
      step: "03",
      icon: Zap,
      title: "Results Sync Instantly",
      description: "All interactions and data automatically sync back to your systems in real-time.",
      features: [
        "Real-time data updates",
        "Automatic synchronization",
        "Instant reporting",
        "Performance analytics dashboard"
      ]
    }
  ];

  const stepsRefs = [
    useScrollAnimation(0.3),
    useScrollAnimation(0.3),
    useScrollAnimation(0.3),
  ];
  const stepsVisible = stepsRefs.map(({ isVisible }) => isVisible);

  return (
    <section className="relative py-32 bg-black overflow-hidden">
      {/* Floating 3D Element */}
      <div className="absolute top-20 right-10 opacity-20 pointer-events-none hidden lg:block">
        <div className="w-96 h-96">
          <Floating3DOrb color="#7E69AB" />
        </div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div
            ref={headerRef}
            className={`text-center mb-24 transition-all duration-1000 ${
              headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
              <span className="text-primary text-sm font-medium">Simple Process</span>
            </div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              How It Works
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              From setup to results in three simple steps. No technical knowledge required.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-20">
            {steps.map((step, index) => (
              <div
                key={index}
                ref={stepsRefs[index].ref}
                className={`relative transition-all duration-1000 ${
                  stepsVisible[index] ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                }`}
              >
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Step Number & Icon */}
                  <div className={`${index % 2 === 1 ? "lg:order-2" : ""}`}>
                    <div className="flex items-start gap-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl" />
                        <div className="relative p-6 bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 rounded-2xl">
                          {React.createElement(step.icon, { className: "h-12 w-12 text-primary" })}
                        </div>
                        <div className="absolute -top-3 -right-3 px-3 py-1 bg-primary rounded-full text-sm font-bold">
                          {step.step}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                          {step.title}
                        </h3>
                        <p className="text-gray-400 text-lg leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className={`${index % 2 === 1 ? "lg:order-1" : ""}`}>
                    <div className="space-y-4">
                      {step.features.map((feature, fIndex) => (
                        <div
                          key={fIndex}
                          className="group p-5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all duration-300 hover:scale-105"
                        >
                          <div className="flex items-center gap-3">
                            <Sparkles className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-white font-medium">{feature}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="flex justify-center my-12">
                    <ArrowRight className="h-8 w-8 text-primary/50 rotate-90 animate-bounce" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div
            ref={ctaRef}
            className={`mt-24 text-center transition-all duration-1000 ${
              ctaVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          >
            <div className="relative p-12 bg-gradient-to-br from-primary/10 via-purple-500/10 to-primary/10 border border-primary/20 rounded-3xl max-w-3xl mx-auto overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(155,135,245,0.1),transparent_50%)]" />
              <div className="relative z-10">
                <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to See It in Action?
                </h3>
                <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
                  Book a free demo and watch AI agents handle real calls and schedule appointments live.
                </p>
                <div className="flex justify-center">
                  <Button asChild className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-xl font-semibold transition-all hover:scale-105">
                    <Link to="/demo">
                      Start Your Free Demo
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
