const CapacityCard = () => {
  return (
    <article className="group border border-blue-200/15 bg-blue-950/[0.08] p-6 backdrop-blur-md transition-colors hover:border-blue-200/35 sm:p-7">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="text-sm font-light text-blue-200/75">03</span>
        <h3 className="text-2xl font-light text-white">Maximize capacity</h3>
      </div>

      <div className="relative mb-6 flex h-[190px] items-center justify-center overflow-hidden">
        <div className="absolute h-36 w-36 rounded-full bg-blue-300/10 blur-3xl" />
        <div className="relative h-40 w-40 overflow-hidden rounded-full border border-blue-100/30 bg-black shadow-[0_0_40px_rgba(96,165,250,0.16),inset_-30px_-15px_60px_rgba(0,0,0,0.92)]">
          <div className="capacity-globe-surface absolute -inset-3 rounded-full bg-[url('/globe/earth-night.jpg')] bg-cover contrast-125 brightness-[1.25] saturate-[0.72]" />
          <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_24%,rgba(186,230,253,0.4),transparent_17%),linear-gradient(110deg,rgba(0,0,0,0.7),transparent_45%,rgba(99,102,241,0.14))]" />
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_-28px_-10px_48px_rgba(0,0,0,0.95),inset_8px_0_18px_rgba(255,255,255,0.06)]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <span className="mb-2 block text-[9px] uppercase tracking-[0.16em] text-white/32">
            Human capacity
          </span>
          <span className="text-xl font-light text-white/50">150/day</span>
        </div>
        <div>
          <span className="mb-2 block text-[9px] uppercase tracking-[0.16em] text-white/42">
            AI capacity
          </span>
          <span className="text-xl font-light text-blue-200">10,000+/day</span>
        </div>
      </div>
    </article>
  );
};

export default CapacityCard;
