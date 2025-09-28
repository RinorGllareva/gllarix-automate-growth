import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, CheckCircle } from "lucide-react";

const FinalCTA = () => {
  return (
    <section className="py-24 section-accent">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Main CTA */}
          <div className="mb-12">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Ready to <span className="text-gradient">Automate</span>
              <br />
              Your Calls & Workflows?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Join 500+ businesses already saving 30+ hours per week and
              capturing more revenue with AI automation. Book your free demo
              today.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
            <Button className="btn-hero text-lg px-8 py-4">
              <Calendar className="mr-2 h-5 w-5" />
              Book a Free Demo
            </Button>
            <Button
              variant="outline"
              className="btn-outline-hero text-lg px-8 py-4"
            >
              Watch Demo Video
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="card-feature text-center">
              <CheckCircle className="h-8 w-8 text-success mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-2">Free Setup</h4>
              <p className="text-sm text-muted-foreground">
                No hidden fees or setup costs
              </p>
            </div>
            <div className="card-feature text-center">
              <CheckCircle className="h-8 w-8 text-success mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-2">
                Lifetime Support
              </h4>
              <p className="text-sm text-muted-foreground">
                Always here to help
              </p>
            </div>
            <div className="card-feature text-center">
              <CheckCircle className="h-8 w-8 text-success mx-auto mb-3" />
              <h4 className="font-semibold text-foreground mb-2">
                Expert Support
              </h4>
              <p className="text-sm text-muted-foreground">
                Dedicated success team
              </p>
            </div>
          </div>

          {/* Demo Details */}
          <div className="card-feature max-w-3xl mx-auto p-8">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              What to Expect in Your Demo
            </h3>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm text-muted-foreground">
                    Live AI agent demonstration
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm text-muted-foreground">
                    Custom workflow design for your business
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm text-muted-foreground">
                    ROI calculation and pricing discussion
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm text-muted-foreground">
                    Integration planning with your tools
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm text-muted-foreground">
                    Q&A with automation experts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm text-muted-foreground">
                    Next steps and implementation plan
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-success/10 border border-success/20 rounded-lg">
              <p className="text-sm text-success font-medium text-center">
                ⏱️ Demo takes 30 minutes • No technical knowledge required • Get
                immediate insights
              </p>
            </div>
          </div>

          {/* Urgency */}
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              While you're thinking about it, your competitors might be
              automating.
            </p>
            <p className="text-lg font-semibold text-foreground">
              Every day you wait is revenue left on the table.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;