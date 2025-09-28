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
      description:
        "Perfect for small businesses looking to automate one key workflow",
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
      description:
        "Most popular for growing businesses wanting comprehensive automation",
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
      description:
        "Full automation suite for large businesses with custom needs",
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
    <section className="py-24 bg-background overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div
            ref={headerRef}
            className={`text-center mb-16 transition-all duration-1000 ${
              headerVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Simple, <span className="text-gradient">Transparent</span> Pricing
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Choose the plan that fits your business size and automation needs.
              All plans include setup assistance and training.
            </p>
            <div
              className={`inline-flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-full text-sm font-medium transition-all duration-700 ${
                headerVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
              }`}
            >
              <Zap className="h-4 w-4" />
              No setup fees • Cancel anytime • 30-day money-back guarantee
            </div>
            <div
              className={`progress-bar mx-auto mt-4 ${
                headerVisible ? "animate" : ""
              }`}
            ></div>
          </div>

          {/* Pricing Cards */}
          <div
            ref={cardsRef}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16"
          >
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative card-interactive card-pricing transition-all duration-700 ${
                  plan.popular ? "featured scale-105 pt-20" : ""
                } ${
                  cardsVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${index * 200}ms` }}
                onMouseEnter={() => setHoveredPlan(index)}
                onMouseLeave={() => setHoveredPlan(null)}
              >
                {plan.popular && (
                  <div className="absolute top-7 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-primary to-accent text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 animate-pulse-glow">
                      <Star className="h-4 w-4" />
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3
                    className={`text-2xl font-bold text-foreground mb-2 transition-colors duration-300 ${
                      hoveredPlan === index ? "text-primary" : ""
                    }`}
                  >
                    {plan.name}
                  </h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gradient">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 transition-all duration-300 ${
                        hoveredPlan === index ? "translate-x-2" : ""
                      }`}
                      style={{ transitionDelay: `${i * 50}ms` }}
                    >
                      <Check
                        className={`h-5 w-5 text-success flex-shrink-0 mt-0.5 transition-all duration-300 ${
                          hoveredPlan === index ? "scale-125" : ""
                        }`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  className={`${
                    plan.popular ? "btn-hero" : "btn-outline-hero"
                  } w-full transition-all duration-300 ${
                    hoveredPlan === index ? "scale-105" : ""
                  }`}
                >
                  {plan.cta}
                  <ArrowRight
                    className={`ml-2 h-4 w-4 transition-transform duration-300 ${
                      hoveredPlan === index ? "translate-x-1" : ""
                    }`}
                  />
                </Button>
              </div>
            ))}
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card-feature">
              <h4 className="text-xl font-bold text-foreground mb-4">
                Usage-Based Billing
              </h4>
              <p className="text-muted-foreground mb-4">
                Additional usage beyond your plan limits is billed at
                competitive rates:
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Voice calls:</span>
                  <span className="font-medium">$0.15/minute</span>
                </div>
                <div className="flex justify-between">
                  <span>SMS messages:</span>
                  <span className="font-medium">$0.05/message</span>
                </div>
                <div className="flex justify-between">
                  <span>Chat interactions:</span>
                  <span className="font-medium">$0.02/interaction</span>
                </div>
              </div>
            </div>

            <div className="card-feature">
              <h4 className="text-xl font-bold text-foreground mb-4">
                What's Included
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-success" />
                  <span className="text-sm text-muted-foreground">
                    Free setup and onboarding
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-success" />
                  <span className="text-sm text-muted-foreground">
                    AI agent training for your business
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-success" />
                  <span className="text-sm text-muted-foreground">
                    Integration support
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-success" />
                  <span className="text-sm text-muted-foreground">
                    Regular performance optimization
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16 text-center">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              Questions about pricing?
            </h3>
            <p className="text-muted-foreground mb-6">
              Our team can help you choose the right plan and estimate costs
              based on your specific needs.
            </p>
            <Button className="btn-outline-hero">
              Schedule Pricing Consultation
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
