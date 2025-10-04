import React, { useState } from 'react';
import { 
  Home, Heart, Sun, Users, Car, CreditCard, Hotel, Shield, GraduationCap,
  ArrowRight, Phone, Calendar, MessageSquare
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Floating3DOrb } from "./Floating3DOrb";

const Industries = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const { ref: gridRef, isVisible: gridVisible } = useScrollAnimation(0.1);
  const { ref: featuresRef, isVisible: featuresVisible } = useScrollAnimation(0.2);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const industries = [
    {
      icon: Home,
      title: "AI Realtor",
      description: "Handles inquiries, books tours, qualifies leads",
      features: ["Lead Qualification", "Property Tours", "Follow-up Calls", "Market Updates"],
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: Heart,
      title: "AI Receptionist",
      description: "Books/reschedules patients, follow-ups, insurance verification",
      features: ["Appointment Booking", "Insurance Verification", "Patient Reminders", "Prescription Alerts"],
      color: "from-red-500 to-pink-600"
    },
    {
      icon: Sun,
      title: "AI Solar Assistant",
      description: "Lead qualification, site surveys, incentive guidance",
      features: ["Site Assessment", "Incentive Information", "Installation Scheduling", "Energy Calculations"],
      color: "from-yellow-500 to-orange-600"
    },
    {
      icon: Users,
      title: "AI Recruiter",
      description: "Screening, interview scheduling, follow-up reminders",
      features: ["Candidate Screening", "Interview Coordination", "Reference Checks", "Onboarding Support"],
      color: "from-green-500 to-emerald-600"
    },
    {
      icon: Car,
      title: "AI Sales Agent",
      description: "Test drives, customer follow-ups, loan pre-qualifications",
      features: ["Test Drive Booking", "Trade-in Valuation", "Financing Options", "Service Reminders"],
      color: "from-purple-500 to-violet-600"
    },
    {
      icon: CreditCard,
      title: "AI Loan Officer",
      description: "Loan intake, document reminders, payment workflows",
      features: ["Application Processing", "Document Collection", "Payment Reminders", "Rate Updates"],
      color: "from-indigo-500 to-blue-600"
    },
    {
      icon: Hotel,
      title: "AI Concierge",
      description: "Reservations, check-ins, feedback collection",
      features: ["Room Booking", "Guest Services", "Local Recommendations", "Feedback Collection"],
      color: "from-teal-500 to-cyan-600"
    },
    {
      icon: Shield,
      title: "AI Insurance Assistant",
      description: "Renewals, claims, quotes, payment reminders",
      features: ["Policy Renewals", "Claims Processing", "Quote Generation", "Risk Assessment"],
      color: "from-orange-500 to-red-600"
    },
    {
      icon: GraduationCap,
      title: "AI Student Assistant",
      description: "Registration, tuition reminders, feedback collection",
      features: ["Course Registration", "Tuition Reminders", "Academic Support", "Event Notifications"],
      color: "from-emerald-500 to-teal-600"
    }
  ];

  return (
    <section className="relative py-32 bg-gradient-to-b from-gray-900 via-black to-gray-900 overflow-hidden">
      {/* 3D Background Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
        <Floating3DOrb color="#9b87f5" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div 
            ref={headerRef}
            className={`text-center mb-24 transition-all duration-1000 ${
              headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
              <span className="text-primary text-sm font-medium">Industry Solutions</span>
            </div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              Built for Your Industry
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              AI agents trained for your specific industry, understanding the nuances of your business.
            </p>
          </div>

          {/* Industries Grid */}
          <div 
            ref={gridRef}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20"
          >
            {industries.map((industry, index) => (
              <div 
                key={index} 
                className={`group relative p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-white/10 hover:border-primary/30 transition-all duration-700 hover:scale-105 cursor-pointer ${
                  gridVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="relative">
                  {/* Icon with gradient */}
                  <div className={`bg-gradient-to-br ${industry.color} p-4 rounded-xl w-fit mb-6 shadow-lg group-hover:shadow-xl transition-all duration-500 ${
                    hoveredCard === index ? 'scale-110 rotate-3' : ''
                  }`}>
                    <industry.icon className="h-8 w-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-primary transition-colors duration-300">
                    {industry.title}
                  </h3>
                  
                  <p className="text-gray-400 mb-6 leading-relaxed">
                    {industry.description}
                  </p>
                  
                  {/* Features */}
                  <div className="space-y-3 mb-6">
                    {industry.features.map((feature, i) => (
                      <div 
                        key={i} 
                        className={`flex items-center gap-3 text-sm text-gray-300 group-hover:text-white transition-all duration-300 ${
                          hoveredCard === index ? 'translate-x-2' : ''
                        }`}
                        style={{ transitionDelay: `${i * 50}ms` }}
                      >
                        <div className={`w-1.5 h-1.5 bg-primary rounded-full transition-all duration-300 ${
                          hoveredCard === index ? 'w-3 h-3' : ''
                        }`}></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                  
                  {/* CTA */}
                  <div className="flex items-center text-primary font-semibold text-sm group-hover:gap-3 gap-2 transition-all duration-300">
                    Learn More
                    <ArrowRight className={`h-4 w-4 group-hover:translate-x-1 transition-transform duration-300 ${
                      hoveredCard === index ? 'scale-125' : ''
                    }`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Common Features */}
          <div 
            ref={featuresRef}
            className={`relative p-10 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl transition-all duration-1000 ${
              featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <h3 className="text-3xl font-bold text-center text-white mb-12">
              Every AI Agent Includes
            </h3>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Phone,
                  title: "Voice Calls",
                  description: "Handle inbound and outbound calls with natural conversation"
                },
                {
                  icon: Calendar,
                  title: "Smart Scheduling",
                  description: "Book, reschedule, and manage appointments automatically"
                },
                {
                  icon: MessageSquare,
                  title: "24/7 Chat Support",
                  description: "Answer questions and assist customers around the clock"
                }
              ].map((feature, index) => (
                <div 
                  key={index}
                  className={`text-center p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-primary/30 transition-all duration-700 hover:scale-105 ${
                    featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
                  style={{ transitionDelay: `${index * 200}ms` }}
                >
                  <div className="bg-primary/10 p-5 rounded-xl w-fit mx-auto mb-4 hover:bg-primary/20 transition-colors duration-300 hover:scale-110">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="font-bold text-white mb-3 text-lg">{feature.title}</h4>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Industries;
