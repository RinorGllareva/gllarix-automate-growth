import { useEffect } from "react";
import { Calendar, Check, Clock, Video } from "lucide-react";
import SecondaryPageShell from "@/components/SecondaryPageShell";

const meetingDetails = [
  {
    icon: Clock,
    label: "30 minutes",
    detail: "A focused workflow review.",
  },
  {
    icon: Video,
    label: "Video call",
    detail: "Join from any location.",
  },
  {
    icon: Calendar,
    label: "Your time zone",
    detail: "Availability adjusts automatically.",
  },
];

const BookMeeting = () => {
  useEffect(() => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://assets.calendly.com/assets/external/widget.js"]',
    );

    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <SecondaryPageShell accent="amber">
      <section className="px-5 pb-24 pt-36 sm:px-8 sm:pb-28 sm:pt-44 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="grid gap-10 border-b border-white/16 pb-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <p className="mb-6 text-[10px] font-light uppercase tracking-[0.3em] text-amber-200/75 sm:text-xs">
                Schedule a conversation
              </p>
              <h1 className="max-w-5xl [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-5xl font-light leading-[0.92] text-white sm:text-6xl md:text-7xl lg:text-8xl">
                Make time for
                <br />
                what moves next.
              </h1>
            </div>

            <div>
              <p className="text-base font-light leading-relaxed text-white/65 sm:text-lg">
                Show us the workflow you want to automate. We will map the
                clearest path from first conversation to completed action.
              </p>
              <div className="mt-6 flex items-center gap-3 text-xs font-light text-amber-100/75">
                <Check className="h-4 w-4" />
                Free discovery call. No preparation required.
              </div>
            </div>
          </header>

          <div className="secondary-glass-surface grid lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="border-b border-white/14 px-7 py-10 lg:border-b-0 lg:border-r lg:border-white/14 lg:py-14 lg:pr-9">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">
                Meeting details
              </p>

              <div className="mt-7 divide-y divide-white/12 border-y border-white/12">
                {meetingDetails.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="flex gap-4 py-5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-amber-100/25 bg-amber-200/[0.07]">
                        <Icon className="h-4 w-4 text-amber-100" />
                      </span>
                      <div>
                        <p className="text-sm font-light text-white">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs font-light leading-relaxed text-white/38">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-7 text-xs font-light leading-relaxed text-white/38">
                You will receive the meeting link and calendar confirmation
                immediately after booking.
              </p>
            </aside>

            <div className="p-2 sm:p-4 lg:p-6">
              <div className="mb-4 flex items-center justify-between border-b border-white/12 px-3 pb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                    Select a time
                  </p>
                  <p className="mt-1 text-sm font-light text-white/70">
                    Gllarix discovery session
                  </p>
                </div>
                <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.8)]" />
              </div>

              <div
                className="calendly-inline-widget min-h-[760px] w-full overflow-hidden"
                data-url="https://calendly.com/rinorgllareva1/30min?hide_gdpr_banner=1&background_color=050608&text_color=ffffff&primary_color=f59e0b"
                style={{ height: "760px", minWidth: "280px" }}
              />
            </div>
          </div>
        </div>
      </section>

    </SecondaryPageShell>
  );
};

export default BookMeeting;
