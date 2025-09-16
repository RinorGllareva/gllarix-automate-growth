import { AlertTriangle, CheckCircle, TrendingUp, Clock, Users, Zap } from "lucide-react";

const PainSolution = () => {
  return (
    <section className="py-24 section-gradient">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-gradient">Stop Losing Money</span> to Manual Tasks
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Every missed call, forgotten follow-up, and manual error costs your business revenue. 
              Here's how we solve it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Pain Points */}
            <div className="space-y-8">
              <div className="text-center md:text-left mb-8">
                <h3 className="text-3xl font-bold text-foreground mb-4 flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                  Common Business Pain Points
                </h3>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-3 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Missed Opportunities</h4>
                    <p className="text-muted-foreground">Calls go unanswered, leads slip through cracks, appointments get forgotten</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-3 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Human Error & Inconsistency</h4>
                    <p className="text-muted-foreground">Manual data entry mistakes, inconsistent customer service, forgotten follow-ups</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <div className="w-2 h-2 bg-destructive rounded-full mt-3 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Time Drain on Staff</h4>
                    <p className="text-muted-foreground">Your team spends hours on repetitive admin tasks instead of growing the business</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Solutions */}
            <div className="space-y-8">
              <div className="text-center md:text-left mb-8">
                <h3 className="text-3xl font-bold text-foreground mb-4 flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-success" />
                  How Gllarix Solves This
                </h3>
              </div>
              
              <div className="space-y-6">
                <div className="card-feature">
                  <div className="flex items-start gap-4">
                    <div className="bg-success/10 p-2 rounded-lg">
                      <Clock className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">24/7 Availability</h4>
                      <p className="text-muted-foreground">AI agents never sleep - capture every lead, answer every call, handle every booking</p>
                    </div>
                  </div>
                </div>
                
                <div className="card-feature">
                  <div className="flex items-start gap-4">
                    <div className="bg-success/10 p-2 rounded-lg">
                      <Zap className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Perfect Consistency</h4>
                      <p className="text-muted-foreground">Same high-quality service every time - no bad days, no forgotten steps</p>
                    </div>
                  </div>
                </div>
                
                <div className="card-feature">
                  <div className="flex items-start gap-4">
                    <div className="bg-success/10 p-2 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Focus on Growth</h4>
                      <p className="text-muted-foreground">Free your team from admin work to focus on strategy, sales, and customer relationships</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results Stats */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient mb-2">40%</div>
              <div className="text-muted-foreground">More Leads Captured</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient mb-2">60%</div>
              <div className="text-muted-foreground">Faster Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient mb-2">90%</div>
              <div className="text-muted-foreground">Fewer No-Shows</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient mb-2">30hrs</div>
              <div className="text-muted-foreground">Saved Per Week</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainSolution;