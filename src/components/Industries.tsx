import { 
  Home, 
  Heart, 
  Sun, 
  Users, 
  Car, 
  CreditCard, 
  Hotel, 
  Shield, 
  GraduationCap,
  ArrowRight,
  Phone,
  Calendar,
  MessageSquare
} from "lucide-react";

const Industries = () => {
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
    <section className="py-24 section-accent">
      <div className="container mx-auto px-6">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-gradient">Industry-Specific</span> AI Solutions
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our AI agents are trained for your specific industry, understanding the nuances 
              and requirements of your business.
            </p>
          </div>

          {/* Industries Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {industries.map((industry, index) => (
              <div key={index} className="card-industry group">
                <div className="relative">
                  {/* Icon with gradient background */}
                  <div className={`bg-gradient-to-br ${industry.color} p-4 rounded-xl w-fit mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                    <industry.icon className="h-8 w-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {industry.title}
                  </h3>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {industry.description}
                  </p>
                  
                  {/* Features */}
                  <div className="space-y-2 mb-6">
                    {industry.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                  
                  {/* CTA */}
                  <div className="flex items-center text-primary font-semibold text-sm group-hover:gap-3 gap-2 transition-all">
                    Learn More
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Common Features */}
          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-center text-foreground mb-8">
              Every AI Agent Includes These Core Features
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-primary/10 p-4 rounded-xl w-fit mx-auto mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">Voice Calls</h4>
                <p className="text-sm text-muted-foreground">Handle inbound and outbound calls with natural conversation</p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 p-4 rounded-xl w-fit mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">Smart Scheduling</h4>
                <p className="text-sm text-muted-foreground">Book, reschedule, and manage appointments automatically</p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 p-4 rounded-xl w-fit mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">24/7 Chat Support</h4>
                <p className="text-sm text-muted-foreground">Answer questions and assist customers around the clock</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Industries;