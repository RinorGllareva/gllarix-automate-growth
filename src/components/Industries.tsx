import React, { useState, useEffect } from 'react';
import { 
  Home, Heart, Sun, Users, Car, CreditCard, Hotel, Shield, GraduationCap,
  Phone, Calendar, MessageSquare, ChevronLeft, ChevronRight
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Button } from "@/components/ui/button";

const Industries = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const industries = [
    {
      icon: Home,
      title: "AI Realtor",
      description: "Intelligent property assistant that streamlines real estate operations",
      color: "from-blue-500 to-blue-600",
      automations: [
        "Lead Qualification",
        "Property Tours Booking",
        "Follow-up Calls",
        "Market Updates",
        "Document Management"
      ]
    },
    {
      icon: Heart,
      title: "AI Receptionist",
      description: "Smart healthcare assistant for seamless patient management",
      color: "from-red-500 to-pink-600",
      automations: [
        "Appointment Booking",
        "Patient Reminders",
        "Insurance Verification",
        "Prescription Alerts",
        "Follow-up Scheduling"
      ]
    },
    {
      icon: Sun,
      title: "AI Solar Assistant",
      description: "Renewable energy consultant for solar installations",
      color: "from-yellow-500 to-orange-600",
      automations: [
        "Lead Qualification",
        "Site Survey Scheduling",
        "Incentive Guidance",
        "ROI Calculations",
        "Installation Updates"
      ]
    },
    {
      icon: Users,
      title: "AI Recruiter",
      description: "Automated talent acquisition and candidate management",
      color: "from-green-500 to-emerald-600",
      automations: [
        "Candidate Screening",
        "Interview Scheduling",
        "Follow-up Reminders",
        "Background Checks",
        "Onboarding Support"
      ]
    },
    {
      icon: Car,
      title: "AI Sales Agent",
      description: "Automotive sales automation for dealerships",
      color: "from-purple-500 to-violet-600",
      automations: [
        "Test Drive Booking",
        "Customer Follow-ups",
        "Loan Pre-qualification",
        "Trade-in Valuation",
        "Delivery Coordination"
      ]
    },
    {
      icon: CreditCard,
      title: "AI Loan Officer",
      description: "Financial services automation for lending operations",
      color: "from-indigo-500 to-blue-600",
      automations: [
        "Loan Application Intake",
        "Document Collection",
        "Payment Reminders",
        "Credit Analysis",
        "Approval Notifications"
      ]
    },
    {
      icon: Hotel,
      title: "AI Concierge",
      description: "Hospitality automation for enhanced guest experiences",
      color: "from-teal-500 to-cyan-600",
      automations: [
        "Reservation Management",
        "Check-in Assistance",
        "Guest Requests",
        "Feedback Collection",
        "Loyalty Programs"
      ]
    },
    {
      icon: Shield,
      title: "AI Insurance Assistant",
      description: "Insurance automation for policy and claims management",
      color: "from-orange-500 to-red-600",
      automations: [
        "Policy Renewals",
        "Claims Processing",
        "Quote Generation",
        "Payment Reminders",
        "Coverage Reviews"
      ]
    },
    {
      icon: GraduationCap,
      title: "AI Student Assistant",
      description: "Educational support for student services and administration",
      color: "from-emerald-500 to-teal-600",
      automations: [
        "Course Registration",
        "Tuition Reminders",
        "Grade Notifications",
        "Event Registration",
        "Feedback Collection"
      ]
    }
  ];

  const commonFeatures = [
    { icon: Phone, title: "Voice Calls", description: "Natural conversations" },
    { icon: Calendar, title: "Smart Scheduling", description: "Automated booking" },
    { icon: MessageSquare, title: "24/7 Support", description: "Always available" }
  ];

  const itemsPerView = 2;
  const maxIndex = Math.ceil(industries.length / itemsPerView) - 1;

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= maxIndex) return 0;
        return prev + 1;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, maxIndex]);

  const nextSlide = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => Math.min(prev + 1, maxIndex));
  };

  const prevSlide = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <section className="relative py-16 bg-gradient-to-b from-gray-900 via-black to-gray-900 overflow-hidden">
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
              AI agents trained for your specific industry needs
            </p>
          </div>

          {/* Side-by-Side Carousel Container */}
          <div className="relative mb-8">
            <div className="relative overflow-hidden">
              <div 
                className="flex transition-transform duration-500 ease-in-out gap-6"
                style={{ transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)` }}
              >
                {industries.map((industry, index) => (
                  <div key={index} className="w-[calc(50%-12px)] flex-shrink-0">
                    <div className="relative p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden group hover:border-primary/30 hover:bg-white/[0.07] transition-all duration-300 h-full">
                      {/* Gradient Background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${industry.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
                      
                      <div className="relative z-10 flex flex-col lg:flex-row gap-6 lg:gap-8">
                        {/* Left Side - Service Info */}
                        <div className="flex-shrink-0 lg:w-[45%]">
                          {/* Icon */}
                          <div className={`bg-gradient-to-br ${industry.color} p-5 rounded-xl shadow-lg w-fit mb-4 group-hover:scale-105 transition-transform duration-300`}>
                            <industry.icon className="h-9 w-9 text-white" />
                          </div>
                          
                          {/* Title & Description */}
                          <div>
                            <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-primary transition-colors duration-300">
                              {industry.title}
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                              {industry.description}
                            </p>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                        {/* Right Side - Automations List */}
                        <div className="flex-1">
                          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">
                            Key Automations
                          </h4>
                          <ul className="space-y-3">
                            {industry.automations.map((automation, idx) => (
                              <li 
                                key={idx}
                                className="flex items-start gap-3 text-gray-300 text-sm group/item"
                              >
                                <div className="flex-shrink-0 mt-1">
                                  <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${industry.color} group-hover/item:scale-125 transition-transform duration-200`} />
                                </div>
                                <span className="group-hover/item:text-white group-hover/item:translate-x-1 transition-all duration-200">
                                  {automation}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Arrows */}
            <Button
              onClick={prevSlide}
              disabled={currentIndex === 0}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full p-3 backdrop-blur-sm z-10 disabled:opacity-50"
              size="icon"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </Button>
            <Button
              onClick={nextSlide}
              disabled={currentIndex >= maxIndex}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full p-3 backdrop-blur-sm z-10 disabled:opacity-50"
              size="icon"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </Button>

            {/* Dots Navigation */}
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: maxIndex + 1 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsAutoPlaying(false);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    index === currentIndex 
                      ? 'w-8 bg-primary' 
                      : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Common Features - Compact Grid */}
          <div className="grid md:grid-cols-3 gap-4">
            {commonFeatures.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all"
              >
                <div className="bg-primary/10 p-2.5 rounded-lg shrink-0">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h5 className="font-semibold text-white text-sm">{feature.title}</h5>
                  <p className="text-xs text-gray-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Industries;
