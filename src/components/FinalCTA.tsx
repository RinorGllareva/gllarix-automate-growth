import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, CheckCircle } from "lucide-react";

const FinalCTA = () => {
  return (
    <section className="relative py-32 bg-gradient-to-b from-black via-gray-900 to-black overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Main CTA */}
          <div className="mb-12">
            <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
              <span className="text-primary text-sm font-medium">Let's Get Started</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight bg-gradient-to-r from-white via-white to-primary bg-clip-text text-transparent">
              Ready to Automate?
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Join 500+ businesses saving 30+ hours per week. Book your free demo today.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-xl font-semibold transition-all hover:scale-105 w-full sm:w-auto">
              <Calendar className="mr-2 h-5 w-5" />
              Book a Free Demo
            </Button>
            <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-6 text-lg rounded-xl font-semibold transition-all hover:scale-105 w-full sm:w-auto">
              Watch Demo Video
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
            <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl text-center hover:bg-white/10 transition-all duration-300">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <h4 className="font-bold text-white mb-2">Free Setup</h4>
              <p className="text-gray-400 text-sm">
                No hidden fees or setup costs
              </p>
            </div>
            <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl text-center hover:bg-white/10 transition-all duration-300">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <h4 className="font-bold text-white mb-2">
                Lifetime Support
              </h4>
              <p className="text-gray-400 text-sm">
                Always here to help
              </p>
            </div>
            <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl text-center hover:bg-white/10 transition-all duration-300">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <h4 className="font-bold text-white mb-2">
                Expert Support
              </h4>
              <p className="text-gray-400 text-sm">
                Dedicated success team
              </p>
            </div>
          </div>

          {/* Demo Details */}
          <div className="relative p-10 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl max-w-4xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-8 text-center">
              What to Expect in Your Demo
            </h3>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-gray-300">
                    Live AI agent demonstration
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-gray-300">
                    Custom workflow design for your business
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-gray-300">
                    ROI calculation and pricing discussion
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-gray-300">
                    Integration planning with your tools
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-gray-300">
                    Q&A with automation experts
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-gray-300">
                    Next steps and implementation plan
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 p-5 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-green-400 font-semibold text-center">
                ⏱️ Demo takes 30 minutes • No technical knowledge required • Get immediate insights
              </p>
            </div>
          </div>

          {/* Urgency */}
          <div className="mt-16 text-center">
            <p className="text-gray-400 mb-2">
              While you're thinking about it, your competitors might be automating.
            </p>
            <p className="text-xl font-bold text-white">
              Every day you wait is revenue left on the table.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;