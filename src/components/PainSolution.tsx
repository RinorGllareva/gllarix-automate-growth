import React from 'react';
import { useScrollAnimation, useCountUp } from "@/hooks/useScrollAnimation";
import alertTriangleIcon from "@/assets/icons/alert-triangle.png";
import checkCircleIcon from "@/assets/icons/check-circle.png";
import clockIcon from "@/assets/icons/clock.png";
import zapIcon from "@/assets/icons/zap.png";
import trendingUpIcon from "@/assets/icons/trending-up.png";

const PainSolution = () => {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation(0.2);
  const { ref: painRef, isVisible: painVisible } = useScrollAnimation(0.3);
  const { ref: solutionRef, isVisible: solutionVisible } = useScrollAnimation(0.3);
  const { ref: statsRef, isVisible: statsVisible } = useScrollAnimation(0.2);

  return (
    <section className="py-24 section-gradient overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div 
            ref={headerRef}
            className={`text-center mb-16 transition-all duration-1000 ${
              headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="text-reveal">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="text-gradient">Stop Losing Money</span> to Manual Tasks
              </h2>
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Every missed call, forgotten follow-up, and manual error costs your business revenue. 
              Here's how we solve it.
            </p>
            <div className={`progress-bar mx-auto mt-4 ${headerVisible ? 'animate' : ''}`}></div>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Pain Points */}
            <div 
              ref={painRef}
              className={`space-y-8 transition-all duration-1000 delay-200 ${
                painVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
              }`}
            >
              <div className="text-center md:text-left mb-8">
                <h3 className="text-3xl font-bold text-foreground mb-4 flex items-center gap-3">
                  <div className={`transition-all duration-700 ${painVisible ? 'rotate-0 scale-100' : 'rotate-12 scale-0'}`}>
                    <img src={alertTriangleIcon} alt="Alert Triangle" className="h-8 w-8 animate-pulse-glow" />
                  </div>
                  <span className="transition-transform duration-300 hover:-translate-y-1 cursor-default">
                    Common Business Pain Points
                  </span>
                </h3>
              </div>
              
              <div className="space-y-6">
                {[
                  {
                    title: "Missed Opportunities",
                    description: "Calls go unanswered, leads slip through cracks, appointments get forgotten",
                    delay: "delay-[400ms]"
                  },
                  {
                    title: "Human Error & Inconsistency", 
                    description: "Manual data entry mistakes, inconsistent customer service, forgotten follow-ups",
                    delay: "delay-[600ms]"
                  },
                  {
                    title: "Time Drain on Staff",
                    description: "Your team spends hours on repetitive admin tasks instead of growing the business", 
                    delay: "delay-[800ms]"
                  }
                ].map((pain, index) => (
                  <div 
                    key={index}
                    className={`card-interactive flex items-start gap-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg transition-all duration-700 ${pain.delay} ${
                      painVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                  >
                    <div className="w-2 h-2 bg-destructive rounded-full mt-3 flex-shrink-0 animate-pulse"></div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">{pain.title}</h4>
                      <p className="text-muted-foreground">{pain.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Solutions */}
            <div 
              ref={solutionRef}
              className={`space-y-8 transition-all duration-1000 delay-400 ${
                solutionVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
              }`}
            >
              <div className="text-center md:text-left mb-8">
                <h3 className="text-3xl font-bold text-foreground mb-4 flex items-center gap-3">
                  <div className={`transition-all duration-700 ${solutionVisible ? 'rotate-0 scale-100' : '-rotate-12 scale-0'}`}>
                    <img src={checkCircleIcon} alt="Check Circle" className="h-8 w-8 animate-pulse-glow" />
                  </div>
                  <span className="transition-transform duration-300 hover:-translate-y-1 cursor-default">
                    How Gllarix Solves This
                  </span>
                </h3>
              </div>
              
              <div className="space-y-6">
                 {[
                   {
                     icon: clockIcon,
                     title: "24/7 Availability",
                     description: "AI agents never sleep - capture every lead, answer every call, handle every booking",
                     delay: "delay-[600ms]"
                   },
                   {
                     icon: zapIcon,
                     title: "Perfect Consistency", 
                     description: "Same high-quality service every time - no bad days, no forgotten steps",
                     delay: "delay-[800ms]"
                   },
                   {
                     icon: trendingUpIcon,
                     title: "Focus on Growth",
                     description: "Free your team from admin work to focus on strategy, sales, and customer relationships",
                     delay: "delay-[1000ms]"
                   }
                 ].map((solution, index) => (
                  <div 
                    key={index}
                    className={`card-interactive card-feature transition-all duration-700 ${solution.delay} ${
                      solutionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                  >
                     <div className="flex items-start gap-4">
                       <div className="bg-success/10 p-2 rounded-lg hover:bg-success/20 transition-colors duration-300">
                         <img src={solution.icon} alt={solution.title} className="h-6 w-6" />
                       </div>
                       <div>
                        <h4 className="font-semibold text-foreground mb-2">{solution.title}</h4>
                        <p className="text-muted-foreground">{solution.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results Stats */}
          <div 
            ref={statsRef}
            className="mt-20 grid grid-cols-1 md:grid-cols-4 gap-8"
          >
            {[
              { value: 40, suffix: "%", label: "More Leads Captured" },
              { value: 60, suffix: "%", label: "Faster Response Time" }, 
              { value: 90, suffix: "%", label: "Fewer No-Shows" },
              { value: 30, suffix: "hrs", label: "Saved Per Week" }
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
                  className={`stat-card text-center transition-all duration-700 ${
                    statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="text-4xl font-bold text-gradient mb-2">
                    {statsVisible ? count : 0}{stat.suffix}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainSolution;