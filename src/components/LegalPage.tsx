import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import SecondaryPageShell from "@/components/SecondaryPageShell";

interface LegalSection {
  title: string;
  content: ReactNode;
}

interface LegalPageProps {
  accent?: "cyan" | "amber" | "cobalt" | "violet" | "pearl";
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
}

const LegalPage = ({
  accent,
  eyebrow,
  title,
  summary,
  updated,
  sections,
}: LegalPageProps) => {
  return (
    <SecondaryPageShell accent={accent}>
      <section className="px-5 pb-24 pt-36 sm:px-8 sm:pb-28 sm:pt-44 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <header className="grid gap-8 border-b border-white/12 pb-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <p className="mb-5 text-[10px] font-light uppercase tracking-[0.3em] text-white/42 sm:text-xs">
                {eyebrow}
              </p>
              <h1 className="[font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-5xl font-light leading-[0.94] text-white sm:text-6xl lg:text-7xl">
                {title}
              </h1>
            </div>
            <div>
              <p className="text-sm font-light leading-relaxed text-white/55 sm:text-base">
                {summary}
              </p>
              <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-white/30">
                Updated {updated}
              </p>
            </div>
          </header>

          <div className="secondary-glass-surface mt-12 divide-y divide-white/10 px-5 sm:px-8">
            {sections.map((section, index) => (
              <section
                key={section.title}
                className="grid gap-5 py-8 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-8 lg:grid-cols-[5rem_18rem_minmax(0,1fr)]"
              >
                <span className="text-xs font-light text-white/30">
                  0{index + 1}
                </span>
                <h2 className="text-xl font-light text-white">
                  {section.title}
                </h2>
                <div className="text-sm font-light leading-7 text-white/52 sm:col-start-2 lg:col-start-auto">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          <a
            href="mailto:hello@gllarix.com"
            className="mt-10 inline-flex items-center gap-3 text-xs font-light uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-65"
          >
            <Mail className="h-4 w-4" />
            Questions about this policy
          </a>
        </div>
      </section>
    </SecondaryPageShell>
  );
};

export default LegalPage;
