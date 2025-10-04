import React from 'react';
import { Star, Quote } from "lucide-react";
import { useScrollAnimation, useCountUp } from "@/hooks/useScrollAnimation";

const Testimonials = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const { ref: statsRef, isVisible: statsVisible } = useScrollAnimation(0.3);
  const { ref: testimonialsRef, isVisible: testimonialsVisible } = useScrollAnimation(0.1);
  const testimonials = [
    {
      name: "Sarah Chen",
      title: "Real Estate Broker",
      company: "Pacific Properties",
      image: "https://images.unsplash.com/photo-1494790108755-2616b69bb04c?w=150&h=150&fit=crop&crop=face",
      rating: 5,
      text: "Gllarix's AI Realtor has been a game-changer. It handles 80% of our lead inquiries and books tours while I sleep. We've increased our conversion rate by 40% and I'm saving 25 hours per week."
    },
    {
      name: "Dr. Michael Rodriguez",
      title: "Practice Owner",
      company: "Central Medical Clinic", 
      image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face",
      rating: 5,
      text: "Our no-show rate dropped from 25% to 8% after implementing the AI Receptionist. Patients love the 24/7 booking and automatic reminders. It's like having the perfect front desk staff."
    },
    {
      name: "James Wilson",
      title: "Sales Manager",
      company: "Elite Auto Group",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      rating: 5,
      text: "The AI Sales Agent books more test drives in a week than our team used to book in a month. It's consistent, never forgets follow-ups, and our customers actually prefer talking to it."
    },
    {
      name: "Lisa Park",
      title: "Operations Director",
      company: "Sunshine Solar Solutions",
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face",
      rating: 5,
      text: "Since implementing the AI Solar Assistant, we've qualified 3x more leads and reduced our sales cycle by 2 weeks. The AI handles all the technical questions perfectly and schedules site visits automatically."
    },
    {
      name: "Robert Kim",
      title: "Branch Manager",
      company: "First National Lending",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      rating: 5,
      text: "Our loan processing time was cut in half with the AI Loan Officer. It collects all required documents, sends reminders, and keeps applicants engaged throughout the entire process."
    },
    {
      name: "Amanda Foster",
      title: "Hotel Manager",
      company: "Downtown Suites",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
      rating: 5,
      text: "The AI Concierge handles 90% of our reservations and guest questions. Our guest satisfaction scores increased by 30% and our front desk team can focus on in-person service."
    }
  ];

  const stats = [
    { number: "95%", label: "Customer Satisfaction" },
    { number: "500+", label: "Businesses Served" },
    { number: "30hrs", label: "Average Time Saved/Week" },
    { number: "40%", label: "Revenue Increase" }
  ];

  return (
    <section className="relative py-32 bg-gradient-to-b from-gray-900 via-black to-gray-900 overflow-hidden" id="testimonials">
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
              <span className="text-primary text-sm font-medium">Success Stories</span>
            </div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              Trusted by 500+
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              See how companies are saving time and growing revenue with AI automation.
            </p>
          </div>

          {/* Stats */}
          <div 
            ref={statsRef}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20"
          >
            {stats.map((stat, index) => {
              const numericValue = parseInt(stat.number.replace(/[^\d]/g, '')) || 0;
              const { count, setIsActive } = useCountUp(numericValue, 2000, 0);
              
              React.useEffect(() => {
                if (statsVisible) {
                  const timer = setTimeout(() => setIsActive(true), index * 200);
                  return () => clearTimeout(timer);
                }
              }, [statsVisible, setIsActive, index]);

              return (
                <div 
                  key={index} 
                  className={`text-center p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-700 hover:scale-105 ${
                    statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent mb-2">
                    {statsVisible ? (
                      stat.number.includes('%') ? `${count}%` :
                      stat.number.includes('+') ? `${count}+` :
                      stat.number.includes('hrs') ? `${count}hrs` :
                      count
                    ) : stat.number}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Testimonials Grid */}
          <div 
            ref={testimonialsRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {testimonials.map((testimonial, index) => (
              <div 
                key={index} 
                className={`group relative p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-white/10 hover:border-primary/30 transition-all duration-700 hover:scale-105 ${
                  testimonialsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                {/* Quote Icon */}
                <div className="absolute -top-3 -left-3 p-3 bg-primary rounded-full transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
                  <Quote className="h-5 w-5 text-white" />
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="h-4 w-4 fill-yellow-400 text-yellow-400 transition-all duration-300 hover:scale-125" 
                      style={{ animationDelay: `${i * 100}ms` }}
                    />
                  ))}
                </div>

                {/* Testimonial Text */}
                <p className="text-gray-300 mb-6 leading-relaxed text-base">
                  "{testimonial.text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-4">
                  <img
                    src={testimonial.image}
                    alt={`${testimonial.name} portrait`}
                    className="w-14 h-14 rounded-full object-cover border-2 border-primary/30 transition-all duration-300 group-hover:scale-110"
                  />
                  <div>
                    <div className="font-bold text-white text-lg">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-gray-400">
                      {testimonial.title}
                    </div>
                    <div className="text-sm text-primary font-semibold">
                      {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Case Study CTA */}
          {/* <div className="mt-16 text-center">
            <div className="card-feature inline-block p-8 max-w-2xl">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Want to See Detailed Results?
              </h3>
              <p className="text-muted-foreground mb-6">
                Download our case studies to see exactly how businesses like yours 
                are achieving measurable results with Gllarix.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="btn-hero">
                  Download Case Studies
                </button>
                <button className="btn-outline-hero">
                  Schedule Your Demo
                </button>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;