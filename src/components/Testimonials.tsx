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
    <section className="py-24 section-gradient overflow-hidden" id="testimonials">
      <div className="container mx-auto px-6">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div 
            ref={headerRef}
            className={`text-center mb-16 transition-all duration-1000 ${
              headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Trusted by <span className="text-gradient">500+ Businesses</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              See how companies across industries are saving time, reducing costs, 
              and growing revenue with Gllarix AI automation.
            </p>
            <div className={`progress-bar mx-auto mt-4 ${headerVisible ? 'animate' : ''}`}></div>
          </div>

          {/* Stats */}
          <div 
            ref={statsRef}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16"
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
                  className={`stat-card text-center transition-all duration-700 ${
                    statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="text-4xl md:text-5xl font-bold text-gradient mb-2">
                    {statsVisible ? (
                      stat.number.includes('%') ? `${count}%` :
                      stat.number.includes('+') ? `${count}+` :
                      stat.number.includes('hrs') ? `${count}hrs` :
                      count
                    ) : stat.number}
                  </div>
                  <div className="text-muted-foreground text-sm md:text-base">
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
                className={`card-interactive card-feature relative transition-all duration-700 hover:scale-105 ${
                  testimonialsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                {/* Quote Icon */}
                <div className="absolute -top-2 -left-2 bg-primary p-2 rounded-full transition-all duration-300 hover:scale-110 hover:rotate-12">
                  <Quote className="h-4 w-4 text-primary-foreground" />
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
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  "{testimonial.text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-4">
                  <img
                    src={testimonial.image}
                    alt={`${testimonial.name} portrait`}
                    className="w-12 h-12 rounded-full object-cover transition-all duration-300 hover:scale-110"
                  />
                  <div>
                    <div className="font-semibold text-foreground">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.title}
                    </div>
                    <div className="text-sm text-primary font-medium">
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