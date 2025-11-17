import React from "react";
import { ArrowRight, Zap, TrendingUp, Users, Clock, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Link } from "react-router-dom";

const Pricing = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const { ref: contentRef, isVisible: contentVisible } = useScrollAnimation(0.1);
  const { ref: factorsRef, isVisible: factorsVisible } = useScrollAnimation(0.15);

  const pricingFactors = [
    {
      icon: Brain,
      title: "AI Complexity",
      description: "Simple workflows to advanced multi-agent systems",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Users,
      title: "Volume of Interactions",
      description: "Pay based on your actual usage and scale",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: TrendingUp,
      title: "Integration Depth",
      description: "Basic to enterprise-level system connections",
      gradient: "from-orange-500 to-red-500",
    },
    {
      icon: Clock,
      title: "Support Level",
      description: "Standard to dedicated account management",
      gradient: "from-green-500 to-emerald-500",
    },
  ];

  return (
    <section className="relative py-32 bg-black overflow-hidden">
      {/* Background Grid */}
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
              <span className="text-primary text-sm font-medium">Flexible Pricing</span>
            </div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              Pay for What You Need
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              No fixed packages. Your pricing adapts to your business complexity and growth.
            </p>
          </div>

          {/* Pricing Scale Visualization */}
          <div
            ref={contentRef}
            className={`mb-24 transition-all duration-1000 delay-200 ${
              contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="relative max-w-5xl mx-auto">
              {/* Gradient Bar */}
              <div className="relative h-32 rounded-3xl overflow-hidden bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 border border-primary/20 backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-30" />
                
                {/* Scale Markers */}
                <div className="absolute inset-0 flex items-center justify-between px-4 md:px-8">
                  <div className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-white mb-2">Simple</div>
                    <div className="text-xs md:text-sm text-gray-400">Basic Automation</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-white mb-2">Growing</div>
                    <div className="text-xs md:text-sm text-gray-400">Multiple Agents</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-white mb-2">Advanced</div>
                    <div className="text-xs md:text-sm text-gray-400">Enterprise Scale</div>
                  </div>
                </div>
              </div>

              {/* Price Range Indicator */}
              <div className="mt-8 text-center">
                <div className="inline-flex flex-col md:flex-row items-center gap-4 bg-background/50 backdrop-blur-sm border border-primary/20 rounded-2xl px-8 py-6">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Starting from</div>
                    <div className="text-3xl font-bold text-primary">$500</div>
                  </div>
                  <div className="hidden md:block h-12 w-px bg-primary/20" />
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Scales to</div>
                    <div className="text-3xl font-bold text-primary">$5,000+</div>
                  </div>
                  <div className="hidden md:block h-12 w-px bg-primary/20" />
                  <div className="text-center md:text-left">
                    <div className="text-sm text-gray-400 mb-1">Based on</div>
                    <div className="text-lg font-semibold text-white">Your Needs</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Factors Grid */}
          <div
            ref={factorsRef}
            className={`mb-20 transition-all duration-1000 delay-300 ${
              factorsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="text-center mb-16">
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">What Influences Your Price?</h3>
              <p className="text-lg text-gray-400">We tailor pricing based on these key factors</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {pricingFactors.map((factor, index) => {
                const Icon = factor.icon;
                return (
                  <div
                    key={index}
                    className="group relative bg-background/30 backdrop-blur-sm border border-primary/20 rounded-2xl p-8 hover:border-primary/40 transition-all duration-300 hover:transform hover:scale-105"
                  >
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${factor.gradient} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
                    
                    <div className="relative">
                      <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${factor.gradient} mb-6`}>
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                      <h4 className="text-2xl font-bold text-white mb-3">{factor.title}</h4>
                      <p className="text-gray-400 text-lg leading-relaxed">{factor.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Value Proposition */}
          <div className="mt-24 max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border border-primary/20 rounded-3xl p-8 md:p-12">
              <div className="text-center mb-12">
                <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">Always Included</h3>
                <p className="text-gray-400 text-lg">No matter your complexity, these are standard</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  "Free setup & onboarding",
                  "24/7 AI agent availability",
                  "Real-time analytics dashboard",
                  "CRM integration",
                  "Regular performance reports",
                  "Ongoing AI optimization",
                  "Multi-channel support",
                  "Dedicated support team"
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-white text-lg">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="mt-20 text-center">
            <div className="inline-block bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 rounded-3xl p-8 md:p-12 max-w-3xl">
              <div className="mb-6">
                <span className="text-5xl">💬</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Let's Build Your Perfect Solution
              </h3>
              <p className="text-gray-400 mb-6 text-lg">
                Book a free consultation to discuss your needs and get a custom quote tailored to your business.
              </p>
              <Button asChild className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-xl font-semibold transition-all hover:scale-105">
                <Link to="/book-meeting">
                  Get Your Custom Quote
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
