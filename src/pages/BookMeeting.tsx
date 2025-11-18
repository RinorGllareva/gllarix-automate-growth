import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Calendar, Clock, Video, CheckCircle } from "lucide-react";

const BookMeeting = () => {
  useEffect(() => {
    // Load Calendly widget script
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const benefits = [
    {
      icon: Calendar,
      title: "Easy Scheduling",
      description: "Pick a time that works best for you"
    },
    {
      icon: Clock,
      title: "30-Minute Session",
      description: "Quick and focused discussion"
    },
    {
      icon: Video,
      title: "Virtual Meeting",
      description: "Connect from anywhere"
    },
    {
      icon: CheckCircle,
      title: "Instant Confirmation",
      description: "Get meeting details immediately"
    }
  ];

  return (
    <main className="min-h-screen bg-black overflow-x-hidden">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-24 sm:pt-32 pb-8 sm:pb-16 px-3 sm:px-6 overflow-x-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        
        <div className="container mx-auto max-w-6xl relative z-10 overflow-x-hidden">
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 border border-primary/20 rounded-full mb-4 sm:mb-6">
              <span className="text-primary text-xs sm:text-sm font-medium">Schedule Your Consultation</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent px-2">
              Book a Meeting with Our Team
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto px-4">
              Discover how Gllarix AI can transform your business operations. Schedule a personalized demo and consultation.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-12">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="p-4 sm:p-5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 hover:border-primary/30 transition-all duration-300"
              >
                <div className="bg-primary/10 p-2.5 sm:p-3 rounded-lg w-fit mb-2 sm:mb-3">
                  <benefit.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="text-white font-semibold mb-1.5 sm:mb-2 text-sm sm:text-base">{benefit.title}</h3>
                <p className="text-gray-400 text-xs sm:text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>

          {/* Calendly Widget Container */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl sm:rounded-2xl p-2 sm:p-4 md:p-8 shadow-2xl overflow-hidden w-full">
            <div 
              className="calendly-inline-widget rounded-lg sm:rounded-xl overflow-hidden w-full" 
              data-url="https://calendly.com/rinorgllareva1/30min?hide_gdpr_banner=1&background_color=000000&text_color=ffffff&primary_color=8b5cf6"
              style={{ width: "100%", height: "600px", minHeight: "600px" }}
            />
          </div>

          {/* Additional Info */}
          <div className="mt-8 sm:mt-12 text-center px-4">
            <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">
              Have questions before booking? Feel free to{" "}
              <a href="/contact" className="text-primary hover:underline">
                contact us
              </a>
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
              <span>✓ No credit card required</span>
              <span>✓ Free consultation</span>
              <span>✓ Instant calendar invite</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default BookMeeting;
