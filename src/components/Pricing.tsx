import React, { useState } from "react";
import { Check, Star, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const Pricing = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const { ref: cardsRef, isVisible: cardsVisible } = useScrollAnimation(0.1);
  const [hoveredPlan, setHoveredPlan] = useState<number | null>(null);

  const plans = [
    {
      name: "Starter",
      price: "$500-1,000",
      period: "/month",
      description: "Perfect for small businesses looking to automate one key workflow",
      features: [
        "One AI automation or agent",
        "Basic CRM integration",
        "Email & SMS reminders",
        "Standard voice quality",
        "Business hours support",
        "Up to 1,000 interactions/month",
        "Basic analytics dashboard",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Pro",
      price: "$1,500-2,500",
      period: "/month",
      description: "Most popular for growing businesses wanting comprehensive automation",
      features: [
        "Multiple AI agents & automations",
        "Advanced CRM + Calendar sync",
        "WhatsApp, SMS, Email integration",
        "Premium voice quality",
        "Priority support (24/7)",
        "Up to 5,000 interactions/month",
        "Advanced analytics & reporting",
        "Custom workflows",
        "A/B testing for scripts",
      ],
      cta: "Book Demo",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "$3,000+",
      period: "/month",
      description: "Full automation suite for large businesses with custom needs",
      features: [
        "Unlimited AI agents & automations",
        "Custom integrations (Salesforce, HubSpot, etc.)",
        "Multi-language support",
        "Ultra-premium voice quality",
        "Dedicated account manager",
        "Unlimited interactions",
        "White-label options",
        "Custom AI training",
        "API access",
        "SLA guarantees",
      ],
      cta: "Contact Sales",
      popular: false,
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
            className={`text-center mb-24 transition-all duration-1000 ${
              headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
              <span className="text-primary text-sm font-medium">Flexible Pricing</span>
            </div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              Simple, Transparent
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
              Choose the plan that fits your business. All plans include setup and training.
            </p>
            <div
              className={`inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-700 ${
                headerVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
              }`}
            >
              <Zap className="h-4 w-4" />
              No setup fees • Cancel anytime • 30-day money-back guarantee
            </div>
          </div>

          {/* Pricing Cards */}
          <div
            ref={cardsRef}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20"
          >
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl hover:bg-white/10 hover:border-primary/30 transition-all duration-700 hover:scale-105 ${
                  plan.popular ? "lg:scale-110 border-primary/50" : ""
                } ${
                  cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${index * 200}ms` }}
                onMouseEnter={() => setHoveredPlan(index)}
                onMouseLeave={() => setHoveredPlan(null)}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-primary to-purple-500 text-white px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                      <Star className="h-4 w-4 fill-current" />
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className={`text-2xl font-bold text-white mb-4 transition-colors duration-300 ${
                    hoveredPlan === index ? 'text-primary' : ''
                  }`}>
                    {plan.name}
                  </h3>
                  <div className="mb-4">
                    <span className="text-5xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 transition-all duration-300 ${
                        hoveredPlan === index ? 'translate-x-2' : ''
                      }`}
                      style={{ transitionDelay: `${i * 50}ms` }}
                    >
                      <Check className={`h-5 w-5 text-green-400 flex-shrink-0 mt-0.5 transition-all duration-300 ${
                        hoveredPlan === index ? 'scale-125' : ''
                      }`} />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className={`w-full ${
                    plan.popular 
                      ? 'bg-primary hover:bg-primary/90 text-white' 
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  } px-6 py-6 text-lg rounded-xl font-semibold transition-all duration-300 ${
                    hoveredPlan === index ? 'scale-105' : ''
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className={`ml-2 h-5 w-5 transition-transform duration-300 ${
                    hoveredPlan === index ? 'translate-x-1' : ''
                  }`} />
                </Button>
              </div>
            ))}
          </div>

          {/* Additional Info */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
              <h4 className="text-2xl font-bold text-white mb-6">
                Usage-Based Billing
              </h4>
              <p className="text-gray-400 mb-6">
                Additional usage beyond your plan limits is billed at competitive rates:
              </p>
              <div className="space-y-4 text-gray-300">
                <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                  <span>Voice calls:</span>
                  <span className="font-bold text-primary">$0.15/minute</span>
                </div>
                <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                  <span>SMS messages:</span>
                  <span className="font-bold text-primary">$0.05/message</span>
                </div>
                <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                  <span>Chat interactions:</span>
                  <span className="font-bold text-primary">$0.02/interaction</span>
                </div>
              </div>
            </div>

            <div className="p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
              <h4 className="text-2xl font-bold text-white mb-6">
                What's Included
              </h4>
              <div className="space-y-4">
                {[
                  "Free setup and onboarding",
                  "AI agent training for your business",
                  "Integration support",
                  "Regular performance optimization"
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <Check className="h-6 w-6 text-green-400" />
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-16 text-center">
            <h3 className="text-3xl font-bold text-white mb-4">
              Questions about pricing?
            </h3>
            <p className="text-gray-400 mb-8">
              Our team can help you choose the right plan and estimate costs based on your needs.
            </p>
            <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-6 text-lg rounded-xl font-semibold transition-all hover:scale-105">
              Schedule Pricing Consultation
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
