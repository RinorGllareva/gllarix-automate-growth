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
    <section className="relative py-16 sm:py-24 md:py-32 bg-black overflow-hidden">
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              Pay for What You Need
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed px-4">
              No fixed packages. Your pricing adapts to your business complexity and growth.
            </p>
          </div>

          {/* Flexible Pricing Display */}
          <div
            ref={contentRef}
            className={`mb-24 transition-all duration-1000 delay-200 ${
              contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="relative max-w-5xl mx-auto">
              {/* Main Pricing Card */}
              <div className="relative">
                {/* Animated Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 rounded-[3rem] blur-3xl animate-pulse" />
                
                <div className="relative bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-xl border-2 border-primary/30 rounded-2xl sm:rounded-3xl md:rounded-[3rem] p-6 sm:p-8 md:p-12 lg:p-16">
                  {/* Decorative Elements */}
                  <div className="absolute top-8 right-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
                  <div className="absolute bottom-8 left-8 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl" />
                  
                  <div className="relative text-center">
                    {/* Icon */}
                    <div className="inline-flex p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-purple-500 mb-6 sm:mb-8 shadow-2xl shadow-primary/50">
                      <Zap className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-white" />
                    </div>
                    
                    {/* Heading */}
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6 px-4">
                      Tailored to Your Business
                    </h3>
                    
                    {/* Price Range */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-6 sm:mb-8">
                      <div className="text-center">
                        <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                          $800
                        </div>
                        <div className="text-gray-400 text-xs sm:text-sm mt-2">Starting Point</div>
                      </div>
                      
                      <div className="flex sm:flex-col items-center gap-2 rotate-90 sm:rotate-0">
                        <div className="hidden sm:block h-1 w-12 sm:w-16 bg-gradient-to-r from-primary to-purple-500 rounded-full" />
                        <ArrowRight className="h-6 w-6 sm:h-8 sm:w-8 text-primary animate-pulse" />
                        <div className="hidden sm:block h-1 w-12 sm:w-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                      </div>
                      
                      <div className="text-center">
                        <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-primary bg-clip-text text-transparent">
                          $5,000+
                        </div>
                        <div className="text-gray-400 text-xs sm:text-sm mt-2">Enterprise Scale</div>
                      </div>
                    </div>
                    
                    {/* Description */}
                    <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-6 sm:mb-8 px-4">
                      Every business is unique. Your pricing is <span className="text-primary font-bold">custom-built</span> based on your specific needs, complexity, and goals.
                    </p>
                    
                    {/* Key Points */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto px-4">
                      <div className="bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                        <Brain className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2 sm:mb-3" />
                        <div className="text-white font-semibold mb-1 sm:mb-2 text-sm sm:text-base">No Fixed Packages</div>
                        <div className="text-gray-400 text-xs sm:text-sm">Pay only for what you actually need</div>
                      </div>
                      
                      <div className="bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                        <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-purple-400 mx-auto mb-2 sm:mb-3" />
                        <div className="text-white font-semibold mb-1 sm:mb-2 text-sm sm:text-base">Scales With You</div>
                        <div className="text-gray-400 text-xs sm:text-sm">Grows as your business grows</div>
                      </div>
                      
                      <div className="bg-pink-500/10 backdrop-blur-sm border border-pink-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                        <Users className="h-6 w-6 sm:h-8 sm:w-8 text-pink-400 mx-auto mb-2 sm:mb-3" />
                        <div className="text-white font-semibold mb-1 sm:mb-2 text-sm sm:text-base">100% Transparent</div>
                        <div className="text-gray-400 text-xs sm:text-sm">Clear breakdown of all costs</div>
                      </div>
                    </div>
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
            <div className="text-center mb-12 sm:mb-16 px-4">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">What Influences Your Price?</h3>
              <p className="text-base sm:text-lg text-gray-400">We tailor pricing based on these key factors</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-6xl mx-auto px-4">
              {pricingFactors.map((factor, index) => {
                const Icon = factor.icon;
                return (
                  <div
                    key={index}
                    className="group relative bg-background/30 backdrop-blur-sm border border-primary/20 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-primary/40 transition-all duration-300 hover:transform hover:scale-105"
                  >
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${factor.gradient} opacity-0 group-hover:opacity-10 rounded-xl sm:rounded-2xl transition-opacity duration-300`} />
                    
                    <div className="relative">
                      <div className={`inline-flex p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br ${factor.gradient} mb-4 sm:mb-6`}>
                        <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                      </div>
                      <h4 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">{factor.title}</h4>
                      <p className="text-gray-400 text-sm sm:text-base md:text-lg leading-relaxed">{factor.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Value Proposition */}
          <div className="mt-16 sm:mt-20 md:mt-24 max-w-4xl mx-auto px-4">
            <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border border-primary/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12">
              <div className="text-center mb-8 sm:mb-10 md:mb-12">
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">Always Included</h3>
                <p className="text-gray-400 text-base sm:text-lg">No matter your complexity, these are standard</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
                  <div key={index} className="flex items-center gap-2 sm:gap-3">
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                    </div>
                    <span className="text-white text-sm sm:text-base md:text-lg">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="mt-16 sm:mt-20 flex justify-center px-4">
            <div className="bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/30 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 max-w-3xl w-full">
              <div className="mb-4 sm:mb-6 text-center">
                <span className="text-4xl sm:text-5xl">💬</span>
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4 text-center">
                Let's Build Your Perfect Solution
              </h3>
              <p className="text-gray-400 mb-6 text-sm sm:text-base md:text-lg text-center">
                Book a free consultation to discuss your needs and get a custom quote tailored to your business.
              </p>
              <div className="flex justify-center">
                <Button asChild className="bg-primary hover:bg-primary/90 text-white px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg rounded-xl font-semibold transition-all hover:scale-105 w-full sm:w-auto">
                  <Link to="/book-meeting">
                    Start Your Free Demo
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
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
