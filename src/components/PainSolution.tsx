import React from "react";
import { useScrollAnimation, useCountUp } from "@/hooks/useScrollAnimation";
import { AlertTriangle, CheckCircle2, Clock, Zap, TrendingUp } from "lucide-react";
import { Floating3DOrb } from "./Floating3DOrb";

const PainSolution = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const { ref: contentRef, isVisible: contentVisible } = useScrollAnimation(0.3);
  const { ref: statsRef, isVisible: statsVisible } = useScrollAnimation(0.2);

  return (
    <section className="relative py-32 bg-gradient-to-b from-gray-900 via-black to-gray-900 overflow-hidden">
      {/* Background Grid Pattern */}
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
              <span className="text-primary text-sm font-medium">The Problem & Solution</span>
            </div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              Stop Losing Revenue
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Every missed call and manual error costs your business. Here's how we solve it.
            </p>
          </div>

          <div
            ref={contentRef}
            className="grid lg:grid-cols-2 gap-16 items-center mb-24"
          >
            {/* Pain Points */}
            <div className={`space-y-8 transition-all duration-1000 ${
              contentVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}>
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-3xl font-bold text-white">Common Pain Points</h3>
              </div>

              {[
                {
                  title: "Missed Opportunities",
                  description: "Calls go unanswered, leads slip away, appointments forgotten",
                },
                {
                  title: "Human Error & Inconsistency",
                  description: "Manual mistakes, inconsistent service, forgotten follow-ups",
                },
                {
                  title: "Time Drain on Staff",
                  description: "Hours wasted on repetitive tasks instead of growth",
                },
              ].map((pain, index) => (
                <div
                  key={index}
                  className="group p-6 bg-red-500/5 border border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all duration-300 hover:scale-105"
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-white mb-2 text-lg">{pain.title}</h4>
                      <p className="text-gray-400">{pain.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Solutions */}
            <div className={`space-y-8 transition-all duration-1000 ${
              contentVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}>
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-3xl font-bold text-white">How Gllarix Solves This</h3>
              </div>

              {[
                {
                  icon: Clock,
                  title: "24/7 Availability",
                  description: "AI agents never sleep - capture every opportunity instantly",
                  color: "text-blue-400",
                  bgColor: "bg-blue-500/10",
                  borderColor: "border-blue-500/20",
                },
                {
                  icon: Zap,
                  title: "Perfect Consistency",
                  description: "Same high-quality service every single time, guaranteed",
                  color: "text-purple-400",
                  bgColor: "bg-purple-500/10",
                  borderColor: "border-purple-500/20",
                },
                {
                  icon: TrendingUp,
                  title: "Focus on Growth",
                  description: "Free your team to focus on strategy and relationships",
                  color: "text-green-400",
                  bgColor: "bg-green-500/10",
                  borderColor: "border-green-500/20",
                },
              ].map((solution, index) => {
                const Icon = solution.icon;
                return (
                  <div
                    key={index}
                    className={`group p-6 ${solution.bgColor} border ${solution.borderColor} rounded-2xl hover:scale-105 transition-all duration-300`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 ${solution.bgColor} rounded-xl`}>
                        <Icon className={`h-6 w-6 ${solution.color}`} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-2 text-lg">{solution.title}</h4>
                        <p className="text-gray-400">{solution.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Section with 3D Element */}
          <div ref={statsRef} className="relative">
            {/* 3D Orb Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 pointer-events-none">
              <Floating3DOrb color="#9b87f5" />
            </div>

            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: 40, suffix: "%", label: "More Leads Captured" },
                { value: 60, suffix: "%", label: "Faster Response" },
                { value: 90, suffix: "%", label: "Fewer No-Shows" },
                { value: 30, suffix: "hrs", label: "Saved Per Week" },
              ].map((stat, index) => {
                const { count, setIsActive } = useCountUp(stat.value, 2000, 0);

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
                      statsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent mb-2">
                      {statsVisible ? count : 0}{stat.suffix}
                    </div>
                    <div className="text-gray-400 text-sm">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainSolution;
