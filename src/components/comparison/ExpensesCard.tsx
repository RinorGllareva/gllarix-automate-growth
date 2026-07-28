const ExpensesCard = () => {
  return (
    <article className="group border border-amber-200/15 bg-amber-950/[0.06] p-6 backdrop-blur-md transition-colors hover:border-amber-200/35 sm:p-7">
      <div className="mb-7 flex items-baseline gap-3">
        <span className="text-sm font-light text-amber-200/75">02</span>
        <h3 className="text-2xl font-light text-white">Reduce expenses</h3>
      </div>

      <div className="relative mb-7 overflow-hidden border border-white/[0.08] bg-black/35 p-4">
        <svg viewBox="0 0 280 140" className="w-full" aria-hidden="true">
          <defs>
            <linearGradient id="humanCostFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="aiCostFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[28, 56, 84, 112].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="280"
              y2={y}
              stroke="rgba(255,255,255,0.055)"
            />
          ))}

          <path
            d="M0,44 C30,40 60,50 90,42 C120,34 150,48 180,40 C210,32 240,44 280,38 L280,140 L0,140 Z"
            fill="url(#humanCostFill)"
          />
          <path
            d="M0,44 C30,40 60,50 90,42 C120,34 150,48 180,40 C210,32 240,44 280,38"
            stroke="rgba(253,186,116,0.58)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            fill="none"
          />
          <path
            d="M0,101 C30,97 60,104 90,98 C120,92 150,102 180,96 C210,90 240,100 280,94 L280,140 L0,140 Z"
            fill="url(#aiCostFill)"
          />
          <path
            d="M0,101 C30,97 60,104 90,98 C120,92 150,102 180,96 C210,90 240,100 280,94"
            stroke="#67e8f9"
            strokeWidth="1.75"
            fill="none"
          />

          {[
            [0, 101],
            [90, 98],
            [180, 96],
            [280, 94],
          ].map(([cx, cy], index) => (
            <circle key={index} cx={cx} cy={cy} r="2.5" fill="#a5f3fc" />
          ))}
        </svg>

        <span className="absolute left-4 top-3 bg-black/70 px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-amber-200/65">
          Human costs
        </span>
        <span className="absolute bottom-8 left-4 bg-black/70 px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-cyan-200/80">
          AI costs
        </span>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <span className="mb-2 block text-[9px] uppercase tracking-[0.16em] text-white/32">
            One human setter
          </span>
          <span className="text-xl font-light text-white/50">$2,000/mo</span>
        </div>
        <div>
          <span className="mb-2 block text-[9px] uppercase tracking-[0.16em] text-white/42">
            Gllarix operating cost
          </span>
          <span className="text-xl font-light text-cyan-200">65% lower</span>
        </div>
      </div>
    </article>
  );
};

export default ExpensesCard;
