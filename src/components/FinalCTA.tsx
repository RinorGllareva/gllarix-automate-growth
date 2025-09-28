import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, CheckCircle } from "lucide-react";

const FinalCTA = () => {
  return (
    <section className="py-24 section-accent">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Main CTA */}
          <div className="mb-8 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight px-4 sm:px-0">
              Ready to <span className="text-gradient">Automate</span>
              <br />
              Your Calls & Workflows?
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
              Join 500+ businesses already saving 30+ hours per week and
              capturing more revenue with AI automation. Book your free demo
              today.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-8 sm:mb-12 px-4 sm:px-0">
            <Button className="btn-hero text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto">
              <Calendar className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Book a Free Demo
            </Button>
            <Button
              variant="outline"
              className="btn-outline-hero text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto"
            >
              Watch Demo Video
              <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12 px-4 sm:px-0">
            <div className="card-feature text-center p-4 sm:p-6">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-success mx-auto mb-2 sm:mb-3" />
              <h4 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">Free Setup</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                No hidden fees or setup costs
              </p>
            </div>
            <div className="card-feature text-center p-4 sm:p-6">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-success mx-auto mb-2 sm:mb-3" />
              <h4 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">
                Lifetime Support
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Always here to help
              </p>
            </div>
            <div className="card-feature text-center p-4 sm:p-6 sm:col-span-2 md:col-span-1">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-success mx-auto mb-2 sm:mb-3" />
              <h4 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">
                Expert Support
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Dedicated success team
              </p>
            </div>
          </div>

          {/* Demo Details */}
          <div className="card-feature max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 mx-4 sm:mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-4 text-center sm:text-left">
              What to Expect in Your Demo
            </h3>
            <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-left">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0"></div>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Live AI agent demonstration
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0"></div>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Custom workflow design for your business
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0"></div>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    ROI calculation and pricing discussion
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0"></div>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Integration planning with your tools
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0"></div>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Q&A with automation experts
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0"></div>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Next steps and implementation plan
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-success/10 border border-success/20 rounded-lg">
              <p className="text-xs sm:text-sm text-success font-medium text-center leading-relaxed">
                ⏱️ Demo takes 30 minutes • No technical knowledge required • Get
                immediate insights
              </p>
            </div>
          </div>

          {/* Urgency */}
          <div className="mt-8 sm:mt-12 text-center px-4 sm:px-0">
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
              While you're thinking about it, your competitors might be
              automating.
            </p>
            <p className="text-base sm:text-lg font-semibold text-foreground">
              Every day you wait is revenue left on the table.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;