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
      description: "Handles inquiries, books tours, and qualifies leads automatically",
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: Heart,
      title: "AI Receptionist",
      description: "Books/reschedules patients, follow-ups, insurance verification",
      color: "from-red-500 to-pink-600"
    },
    {
      icon: Sun,
      title: "AI Solar Assistant",
      description: "Lead qualification, site surveys, and incentive guidance",
      color: "from-yellow-500 to-orange-600"
    },
    {
      icon: Users,
      title: "AI Recruiter",
      description: "Screening, interview scheduling, and follow-up reminders",
      color: "from-green-500 to-emerald-600"
    },
    {
      icon: Car,
      title: "AI Sales Agent",
      description: "Test drives, customer follow-ups, loan pre-qualifications",
      color: "from-purple-500 to-violet-600"
    },
    {
      icon: CreditCard,
      title: "AI Loan Officer",
      description: "Loan intake, document reminders, payment workflows",
      color: "from-indigo-500 to-blue-600"
    },
    {
      icon: Hotel,
      title: "AI Concierge",
      description: "Reservations, check-ins, and feedback collection",
      color: "from-teal-500 to-cyan-600"
    },
    {
      icon: Shield,
      title: "AI Insurance Assistant",
      description: "Renewals, claims, quotes, and payment reminders",
      color: "from-orange-500 to-red-600"
    },
    {
      icon: GraduationCap,
      title: "AI Student Assistant",
      description: "Registration, tuition reminders, and feedback collection",
      color: "from-emerald-500 to-teal-600"
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
                    <div className="relative p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden group hover:border-primary/30 transition-all h-full">
                      {/* Gradient Background */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${industry.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                      
                      <div className="relative z-10">
                        {/* Icon */}
                        <div className={`bg-gradient-to-br ${industry.color} p-6 rounded-xl shadow-xl w-fit mb-4`}>
                          <industry.icon className="h-10 w-10 text-white" />
                        </div>
                        
                        {/* Content */}
                        <div>
                          <h3 className="text-2xl font-bold text-white mb-2">
                            {industry.title}
                          </h3>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {industry.description}
                          </p>
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
