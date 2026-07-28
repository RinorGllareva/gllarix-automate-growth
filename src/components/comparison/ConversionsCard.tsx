const ConversionsCard = () => {
  return (
    <article className="group border border-emerald-200/15 bg-emerald-950/[0.08] p-6 backdrop-blur-md transition-colors hover:border-emerald-200/35 sm:p-7">
      <div className="mb-7 flex items-baseline gap-3">
        <span className="text-sm font-light text-emerald-200/75">01</span>
        <h3 className="text-2xl font-light text-white">Increase conversions</h3>
      </div>

      <div className="relative mb-7 overflow-hidden border border-white/[0.08] bg-black/35 p-5">
        <div className="pointer-events-none absolute inset-5 flex flex-col justify-between">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-px w-full bg-white/[0.055]" />
          ))}
        </div>

        <div className="relative flex h-36 items-end justify-center gap-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-[50px] w-12 border border-white/10 bg-white/[0.08]" />
            <span className="text-[9px] uppercase tracking-[0.18em] text-white/35">
              Human CVR
            </span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="h-[110px] w-12 border border-cyan-200/45 bg-gradient-to-b from-emerald-100/85 to-cyan-400/20 shadow-[0_0_24px_rgba(34,211,238,0.16)]" />
            <span className="text-[9px] uppercase tracking-[0.18em] text-cyan-100/70">
              AI CVR
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <span className="mb-2 block text-[9px] uppercase tracking-[0.16em] text-white/32">
            Human average
          </span>
          <span className="text-xl font-light text-white/50">10-20%</span>
        </div>
        <div>
          <span className="mb-2 block text-[9px] uppercase tracking-[0.16em] text-white/42">
            Gllarix average
          </span>
          <span className="text-xl font-light text-emerald-200">30-40%</span>
        </div>
      </div>
    </article>
  );
};

export default ConversionsCard;
