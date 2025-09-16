import { ArrowRight, Settings, Bot, Zap } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      icon: Settings,
      title: "Connect Your Systems",
      description: "Link Gllarix to your CRM, calendar, or lead sources in minutes. No technical expertise required.",
      details: ["CRM Integration", "Calendar Sync", "Lead Sources", "Custom Workflows"]
    },
    {
      icon: Bot,
      title: "AI Agents Go to Work", 
      description: "Our AI agents start handling calls, bookings, reminders, and follow-ups using your business rules.",
      details: ["Voice Calls", "Appointment Booking", "Lead Qualification", "Customer Follow-ups"]
    },
    {
      icon: Zap,
      title: "Results Sync Instantly",
      description: "All interactions and data automatically sync back to your systems in real-time.",
      details: ["Real-time Updates", "Data Synchronization", "Automated Reports", "Performance Analytics"]
    }
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              How <span className="text-gradient">Gllarix</span> Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Get up and running in minutes with our simple 3-step process. 
              No complex setup, no lengthy training periods.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-16">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Connection Line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute left-1/2 top-32 w-px h-16 bg-gradient-to-b from-border to-transparent transform -translate-x-0.5"></div>
                )}
                
                <div className={`grid md:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'md:grid-flow-dense' : ''}`}>
                  {/* Content */}
                  <div className={`space-y-6 ${index % 2 === 1 ? 'md:col-start-2' : ''}`}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="bg-primary/10 p-3 rounded-xl">
                        <step.icon className="h-8 w-8 text-primary" />
                      </div>
                      <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                    </div>
                    
                    <h3 className="text-3xl font-bold text-foreground">{step.title}</h3>
                    <p className="text-lg text-muted-foreground leading-relaxed">{step.description}</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {step.details.map((detail, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                          {detail}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visual */}
                  <div className={`relative ${index % 2 === 1 ? 'md:col-start-1' : ''}`}>
                    <div className="card-feature p-8 text-center relative overflow-hidden">
                      <div className="relative z-10">
                        <step.icon className="h-20 w-20 text-primary mx-auto mb-4" />
                        <div className="text-6xl font-bold text-gradient mb-2">
                          {index + 1}
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                          Step {index + 1}
                        </div>
                      </div>
                      
                      {/* Background decoration */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5"></div>
                      <div className="absolute top-4 right-4 w-12 h-12 bg-primary/10 rounded-full blur-sm"></div>
                      <div className="absolute bottom-4 left-4 w-8 h-8 bg-accent/10 rounded-full blur-sm"></div>
                    </div>
                  </div>
                </div>

                {/* Arrow between steps */}
                {index < steps.length - 1 && (
                  <div className="flex justify-center mt-8 md:hidden">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <div className="card-feature inline-block p-8">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Ready to Get Started?
              </h3>
              <p className="text-muted-foreground mb-6">
                Join 500+ businesses already saving 30+ hours per week
              </p>
              <button className="btn-hero">
                Start Your Free Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;