import React, { useState } from 'react';
import { 
  Home, Heart, Sun, Users, Car, CreditCard, Hotel, Shield, GraduationCap,
  Phone, Calendar, MessageSquare, CheckCircle2
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Floating3DOrb } from "./Floating3DOrb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Industries = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const [selectedIndustry, setSelectedIndustry] = useState("realtor");

  const industries = [
    {
      id: "realtor",
      icon: Home,
      title: "AI Realtor",
      description: "Handles inquiries, books tours, qualifies leads",
      features: ["Lead Qualification", "Property Tours", "Follow-up Calls", "Market Updates"],
      color: "from-blue-500 to-blue-600",
      bgGlow: "bg-blue-500/20"
    },
    {
      id: "receptionist",
      icon: Heart,
      title: "AI Receptionist",
      description: "Books/reschedules patients, follow-ups, insurance verification",
      features: ["Appointment Booking", "Insurance Verification", "Patient Reminders", "Prescription Alerts"],
      color: "from-red-500 to-pink-600",
      bgGlow: "bg-red-500/20"
    },
    {
      id: "solar",
      icon: Sun,
      title: "AI Solar Assistant",
      description: "Lead qualification, site surveys, incentive guidance",
      features: ["Site Assessment", "Incentive Information", "Installation Scheduling", "Energy Calculations"],
      color: "from-yellow-500 to-orange-600",
      bgGlow: "bg-yellow-500/20"
    },
    {
      id: "recruiter",
      icon: Users,
      title: "AI Recruiter",
      description: "Screening, interview scheduling, follow-up reminders",
      features: ["Candidate Screening", "Interview Coordination", "Reference Checks", "Onboarding Support"],
      color: "from-green-500 to-emerald-600",
      bgGlow: "bg-green-500/20"
    },
    {
      id: "sales",
      icon: Car,
      title: "AI Sales Agent",
      description: "Test drives, customer follow-ups, loan pre-qualifications",
      features: ["Test Drive Booking", "Trade-in Valuation", "Financing Options", "Service Reminders"],
      color: "from-purple-500 to-violet-600",
      bgGlow: "bg-purple-500/20"
    },
    {
      id: "loan",
      icon: CreditCard,
      title: "AI Loan Officer",
      description: "Loan intake, document reminders, payment workflows",
      features: ["Application Processing", "Document Collection", "Payment Reminders", "Rate Updates"],
      color: "from-indigo-500 to-blue-600",
      bgGlow: "bg-indigo-500/20"
    },
    {
      id: "concierge",
      icon: Hotel,
      title: "AI Concierge",
      description: "Reservations, check-ins, feedback collection",
      features: ["Room Booking", "Guest Services", "Local Recommendations", "Feedback Collection"],
      color: "from-teal-500 to-cyan-600",
      bgGlow: "bg-teal-500/20"
    },
    {
      id: "insurance",
      icon: Shield,
      title: "AI Insurance Assistant",
      description: "Renewals, claims, quotes, payment reminders",
      features: ["Policy Renewals", "Claims Processing", "Quote Generation", "Risk Assessment"],
      color: "from-orange-500 to-red-600",
      bgGlow: "bg-orange-500/20"
    },
    {
      id: "student",
      icon: GraduationCap,
      title: "AI Student Assistant",
      description: "Registration, tuition reminders, feedback collection",
      features: ["Course Registration", "Tuition Reminders", "Academic Support", "Event Notifications"],
      color: "from-emerald-500 to-teal-600",
      bgGlow: "bg-emerald-500/20"
    }
  ];

  const commonFeatures = [
    { icon: Phone, title: "Voice Calls", description: "Handle inbound and outbound calls with natural conversation" },
    { icon: Calendar, title: "Smart Scheduling", description: "Book, reschedule, and manage appointments automatically" },
    { icon: MessageSquare, title: "24/7 Chat Support", description: "Answer questions and assist customers around the clock" }
  ];

  return (
    <section className="relative py-20 bg-gradient-to-b from-gray-900 via-black to-gray-900 overflow-hidden">
      {/* 3D Background Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden lg:block">
        <Floating3DOrb color="#9b87f5" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div 
            ref={headerRef}
            className={`text-center mb-12 transition-all duration-1000 ${
              headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-4">
              <span className="text-primary text-sm font-medium">Industry Solutions</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              Built for Your Industry
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              AI agents trained for your specific industry, understanding the nuances of your business.
            </p>
          </div>

          {/* Tabs Interface */}
          <Tabs value={selectedIndustry} onValueChange={setSelectedIndustry} className="w-full">
            {/* Tab Triggers - Horizontal Scroll on Mobile */}
            <TabsList className="w-full h-auto flex-wrap lg:flex-nowrap justify-start lg:justify-center bg-white/5 border border-white/10 p-2 mb-8 overflow-x-auto">
              {industries.map((industry) => (
                <TabsTrigger
                  key={industry.id}
                  value={industry.id}
                  className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white text-gray-400 rounded-lg transition-all whitespace-nowrap"
                >
                  <industry.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{industry.title.replace('AI ', '')}</span>
                  <span className="sm:hidden">{industry.title.replace('AI ', '').split(' ')[0]}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Tab Content */}
            {industries.map((industry) => (
              <TabsContent key={industry.id} value={industry.id} className="mt-0">
                <div className="grid lg:grid-cols-2 gap-8 items-center">
                  {/* Industry Details */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={`bg-gradient-to-br ${industry.color} p-4 rounded-2xl shadow-lg`}>
                        <industry.icon className="h-10 w-10 text-white" />
                      </div>
                      <h3 className="text-3xl font-bold text-white">{industry.title}</h3>
                    </div>
                    
                    <p className="text-lg text-gray-400 leading-relaxed">
                      {industry.description}
                    </p>

                    {/* Features Grid */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {industry.features.map((feature, i) => (
                        <div 
                          key={i}
                          className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
                        >
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Common Features */}
                  <div className="space-y-4">
                    <h4 className="text-xl font-bold text-white mb-4">Includes Standard Features:</h4>
                    {commonFeatures.map((feature, index) => (
                      <div 
                        key={index}
                        className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all"
                      >
                        <div className="bg-primary/10 p-3 rounded-lg shrink-0">
                          <feature.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-white mb-1">{feature.title}</h5>
                          <p className="text-sm text-gray-400">{feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </section>
  );
};

export default Industries;
