import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import SecondaryPageShell from "@/components/SecondaryPageShell";

const team = [
  {
    name: "Rinor Gllareva",
    role: "CEO & Founder",
    focus: "Company direction, partnerships, and customer outcomes.",
    image: "/team/rinor-gllareva.webp",
  },
  {
    name: "Artin Ahmeti",
    role: "COO & CTO",
    focus: "Technology, operations, and reliable AI delivery.",
    image: "/team/artin-ahmeti.webp",
  },
];

const About = () => {
  return (
    <SecondaryPageShell accent="cyan">
      <section className="px-5 pb-20 pt-36 sm:px-8 sm:pb-24 sm:pt-44 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="grid min-h-[55vh] gap-10 border-b border-white/12 pb-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.55fr)] lg:items-end">
            <div>
              <p className="mb-6 text-[10px] font-light uppercase tracking-[0.3em] text-white/42 sm:text-xs">
                About Gllarix
              </p>
              <h1 className="max-w-5xl [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-5xl font-light leading-[0.92] text-white sm:text-6xl md:text-7xl lg:text-8xl">
                We make routine work run itself.
              </h1>
            </div>

            <div>
              <p className="text-base font-light leading-relaxed text-white/58 sm:text-lg">
                Gllarix builds AI agents that handle customer conversations,
                bookings, qualification, and follow-up inside the tools a
                business already uses.
              </p>
              <Link
                to="/contact"
                className="mt-7 inline-flex items-center gap-3 text-xs font-light uppercase tracking-[0.16em] text-white"
              >
                Talk to the founders
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </header>

          <section className="py-16 sm:py-20">
            <div className="secondary-glass-surface grid gap-10 p-7 sm:p-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:p-12">
              <div>
                <p className="mb-5 text-[10px] uppercase tracking-[0.28em] text-cyan-200/70">
                  Our story
                </p>
                <h2 className="max-w-xl text-3xl font-light leading-tight text-white sm:text-4xl lg:text-5xl">
                  Built from a belief that people should move ideas forward,
                  not move information between tools.
                </h2>
              </div>

              <div className="self-end">
                <p className="text-base font-light leading-relaxed text-white/62 sm:text-lg">
                  Gllarix began with a simple frustration: talented teams were
                  losing their best hours to missed calls, repeated questions,
                  calendar coordination, and follow-up that never stopped.
                  Businesses did not need another dashboard. They needed the
                  work itself to get done.
                </p>
                <p className="mt-5 text-base font-light leading-relaxed text-white/52 sm:text-lg">
                  Rinor and Artin founded Gllarix to build AI that works quietly
                  inside the systems companies already trust. Every agent is
                  designed to listen, understand, act, and hand people back the
                  time to create, lead, and grow.
                </p>
                <p className="mt-8 border-l border-cyan-200/45 pl-5 text-xl font-light leading-snug text-cyan-50 sm:text-2xl">
                  The future should not demand more attention. It should give
                  attention back.
                </p>
              </div>
            </div>
          </section>

          <section className="pb-16 sm:pb-20">
            <div className="mb-9 flex items-end justify-between gap-6">
              <div>
                <p className="mb-4 text-[10px] uppercase tracking-[0.26em] text-white/38">
                  Leadership
                </p>
                <h2 className="text-3xl font-light text-white sm:text-4xl">
                  The people responsible.
                </h2>
              </div>
              <span className="hidden text-xs font-light text-white/30 sm:block">
                Prishtina, Kosovo
              </span>
            </div>

            <div className="secondary-glass-surface grid md:grid-cols-2 md:divide-x md:divide-white/12">
              {team.map((member, index) => (
                <article
                  key={member.name}
                  className="group border-b border-white/12 last:border-b-0 md:border-b-0"
                >
                  <div className="relative aspect-[4/3] overflow-hidden border-b border-white/12">
                    <img
                      src={member.image}
                      alt={`${member.name}, ${member.role} at Gllarix`}
                      className="h-full w-full object-cover object-[center_28%] transition-transform duration-700 group-hover:scale-[1.015]"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    <span className="absolute right-5 top-5 text-xs font-light text-white/55">
                      0{index + 1}
                    </span>
                  </div>

                  <div className="p-7 sm:p-9">
                    <p className="mb-3 text-[10px] font-light uppercase tracking-[0.18em] text-cyan-200/75">
                      {member.role}
                    </p>
                    <h3 className="text-3xl font-light text-white">
                      {member.name}
                    </h3>
                    <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-white/45">
                      {member.focus}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </SecondaryPageShell>
  );
};

export default About;
