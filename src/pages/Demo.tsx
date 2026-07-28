import { useState } from "react";
import { ArrowRight, CalendarCheck, Play, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import SecondaryPageShell from "@/components/SecondaryPageShell";

const Demo = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <SecondaryPageShell accent="cobalt">
      <section className="px-5 pb-24 pt-36 sm:px-8 sm:pb-28 sm:pt-44 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="grid gap-10 border-b border-white/12 pb-12 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end">
            <div>
              <p className="mb-6 text-[10px] font-light uppercase tracking-[0.3em] text-white/42 sm:text-xs">
                See it work
              </p>
              <h1 className="max-w-5xl [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-5xl font-light leading-[0.92] text-white sm:text-6xl md:text-7xl lg:text-8xl">
                One call.
                <br />
                Fully handled.
              </h1>
            </div>
            <p className="text-base font-light leading-relaxed text-white/55 sm:text-lg">
              Watch an AI agent answer a customer, understand the request, and
              move it to the next action.
            </p>
          </header>

          <div className="secondary-glass-surface grid lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <div className="relative min-h-[24rem] overflow-hidden border-b border-white/12 lg:min-h-[36rem] lg:border-b-0 lg:border-r lg:border-white/12">
              {isPlaying ? (
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src="https://www.youtube.com/embed/Wlph6saSm-A?autoplay=1&rel=0"
                  title="Gllarix AI agent demonstration"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  className="group absolute inset-0 flex w-full flex-col items-center justify-start bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_40%)] pt-24 text-white outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/70 sm:pt-28 lg:pt-24"
                  aria-label="Play the Gllarix AI agent demo"
                >
                  <span className="flex h-20 w-20 items-center justify-center border border-white/25 bg-black/45 backdrop-blur-md transition-transform duration-300 group-hover:scale-105">
                    <Play className="ml-1 h-7 w-7 fill-white" />
                  </span>
                  <span className="mt-6 text-xs font-light uppercase tracking-[0.2em] text-white/55">
                    Play live workflow
                  </span>
                </button>
              )}
            </div>

            <div className="flex flex-col justify-between p-7 sm:p-9 lg:p-10">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/34">
                  What to notice
                </p>
                <ol className="mt-7 divide-y divide-white/10 border-y border-white/12">
                  {[
                    ["01", "Answers naturally", "The customer speaks normally."],
                    ["02", "Follows your rules", "Qualification stays consistent."],
                    ["03", "Completes the task", "The appointment is confirmed."],
                  ].map(([number, title, detail]) => (
                    <li key={number} className="grid grid-cols-[2rem_1fr] gap-3 py-5">
                      <span className="text-[10px] text-blue-200/75">{number}</span>
                      <div>
                        <p className="text-base font-light text-white">{title}</p>
                        <p className="mt-1 text-xs font-light text-white/38">
                          {detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <Link
                to="/book-meeting"
                className="mt-10 inline-flex items-center justify-between border border-white/20 px-5 py-4 text-xs font-light uppercase tracking-[0.15em] text-white transition-colors hover:bg-white hover:text-black"
              >
                Demo your workflow
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-5 py-9 sm:grid-cols-2">
            <div className="flex items-center gap-4 text-sm font-light text-white/55">
              <Sparkles className="h-5 w-5 text-blue-200" />
              Configured around your actual scripts and business rules.
            </div>
            <div className="flex items-center gap-4 text-sm font-light text-white/55">
              <CalendarCheck className="h-5 w-5 text-cyan-200" />
              Connected directly to calendars, CRM, and follow-up.
            </div>
          </div>
        </div>
      </section>
    </SecondaryPageShell>
  );
};

export default Demo;
