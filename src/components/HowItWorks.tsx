import { ArrowRight, Settings, Bot, Zap } from "lucide-react";
import img from "../../public/Gllarix_NamePNG.png";

const HowItWorks = () => {
  const steps = [
    {
      icon: Settings,
      title: "Connect Your Systems",
      description:
        "Link Gllarix to your CRM, calendar, or lead sources in minutes. No technical expertise required.",
      details: [
        "CRM Integration",
        "Calendar Sync",
        "Lead Sources",
        "Custom Workflows",
      ],
    },
    {
      icon: Bot,
      title: "AI Agents Go to Work",
      description:
        "Our AI agents start handling calls, bookings, reminders, and follow-ups using your business rules.",
      details: [
        "Voice Calls",
        "Appointment Booking",
        "Lead Qualification",
        "Customer Follow-ups",
      ],
    },
    {
      icon: Zap,
      title: "Results Sync Instantly",
      description:
        "All interactions and data automatically sync back to your systems in real-time.",
      details: [
        "Real-time Updates",
        "Data Synchronization",
        "Automated Reports",
        "Performance Analytics",
      ],
    },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 sm:mb-16 px-4 sm:px-0">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
              <span>How</span>
              <img
                src={img}
                alt="Gllarix Name"
                className="h-10 sm:h-12 md:h-14 inline-block align-middle"
              />
              <span>Works</span>
            </h2>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Get up and running in minutes with our simple 3-step process. No
              complex setup, no lengthy training periods.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-12 sm:space-y-16">
            {steps.map((step, index) => (
              <div key={index} className="relative px-4 sm:px-0">
                {/* Connection Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute left-1/2 top-32 w-px h-16 bg-gradient-to-b from-border to-transparent transform -translate-x-0.5"></div>
                )}

                <div
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center ${
                    index % 2 === 1 ? "lg:grid-flow-dense" : ""
                  }`}
                >
                  {/* Content */}
                  <div
                    className={`space-y-4 sm:space-y-6 ${
                      index % 2 === 1 ? "lg:col-start-2" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className="bg-primary/10 p-2 sm:p-3 rounded-xl">
                        <step.icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                      </div>
                      <div className="bg-primary text-primary-foreground w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm">
                        {index + 1}
                      </div>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {step.details.map((detail, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground"
                        >
                          <div className="w-1.5 h-1.5 bg-primary rounded-full shrink-0"></div>
                          {detail}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visual */}
                  <div
                    className={`relative ${
                      index % 2 === 1 ? "lg:col-start-1" : ""
                    }`}
                  >
                    <div className="card-feature p-6 sm:p-8 text-center relative overflow-hidden">
                      <div className="relative z-10">
                        <step.icon className="h-12 w-12 sm:h-16 sm:w-16 text-primary mx-auto mb-2 sm:mb-3" />
                        <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gradient mb-1 sm:mb-2">
                          {index + 1}
                        </div>
                        <div className="text-sm sm:text-base font-semibold text-foreground">
                          Step {index + 1}
                        </div>
                      </div>

                      {/* Background decoration */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
                      <div className="absolute top-4 right-4 w-8 h-8 sm:w-12 sm:h-12 bg-primary/10 rounded-full blur-sm"></div>
                      <div className="absolute bottom-4 left-4 w-6 h-6 sm:w-8 sm:h-8 bg-accent/10 rounded-full blur-sm"></div>
                    </div>
                  </div>
                </div>

                {/* Arrow between steps */}
                {index < steps.length - 1 && (
                  <div className="flex justify-center mt-6 sm:mt-8 lg:hidden">
                    <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12 sm:mt-16 px-4 sm:px-0">
            <div className="card-feature inline-block p-6 sm:p-8 max-w-md mx-auto">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">
                Ready to Get Started?
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                Join 500+ businesses already saving 30+ hours per week
              </p>
              <button className="btn-hero inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 text-sm sm:text-base">
                Start Your Free Demo
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
